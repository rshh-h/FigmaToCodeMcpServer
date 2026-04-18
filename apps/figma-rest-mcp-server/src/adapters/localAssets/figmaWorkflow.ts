import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HttpClient } from "../../infrastructure/httpClient.js";
import type { Logger } from "../../infrastructure/logger.js";
import {
  buildSyntheticNodeJson,
  extensionFromContentType,
  nodeIdToSlug,
  saveBuffer,
  saveJson,
  saveText,
  toRepoRelativePath,
} from "./figmaScriptCommon.js";
import {
  collectVectorExportRoots,
  toVectorCandidate,
} from "./figmaVectorExport.js";
import { collectVariableIds } from "./figmaRestNodeUtils.js";
import { fetchSvgSignedUrls } from "../vectorSvgExport.js";

type DocumentEntry = {
  nodeId: string;
  document: Record<string, unknown>;
};

type WorkflowTargetOptions = {
  fileKey: string;
  documents: DocumentEntry[];
  baseDir: string;
  workspaceRoot: string;
  useCache: boolean;
  token: string;
  httpClient: HttpClient;
  logger?: Logger;
  traceId?: string;
  outputSlug?: string;
};

function collectImageRefs(
  node: Record<string, unknown> | null | undefined,
  imageRefs = new Set<string>(),
): Set<string> {
  if (!node || typeof node !== "object") {
    return imageRefs;
  }

  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (
        fill &&
        typeof fill === "object" &&
        (fill as { type?: unknown }).type === "IMAGE" &&
        typeof (fill as { imageRef?: unknown }).imageRef === "string"
      ) {
        imageRefs.add((fill as { imageRef: string }).imageRef);
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === "object") {
        collectImageRefs(child as Record<string, unknown>, imageRefs);
      }
    }
  }

  return imageRefs;
}

function collectDescendantNodeIds(
  node: Record<string, unknown>,
  acc: string[] = [],
): string[] {
  if (!Array.isArray(node.children)) {
    return acc;
  }

  for (const child of node.children) {
    if (!child || typeof child !== "object") {
      continue;
    }

    const childNode = child as Record<string, unknown>;
    if (typeof childNode.id === "string") {
      acc.push(childNode.id);
    }
    collectDescendantNodeIds(childNode, acc);
  }

  return acc;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}

function cachedPath(baseDir: string, filename: string): string {
  return join(baseDir, filename);
}

async function saveSourceNodeJsons(
  documents: DocumentEntry[],
  baseDir: string,
  fileKey: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of documents) {
    paths.push(
      await saveJson(
        `figma-node-${fileKey}-${nodeIdToSlug(entry.nodeId)}.json`,
        buildSyntheticNodeJson(entry.nodeId, entry.document),
        { baseDir },
      ),
    );
  }
  return paths;
}

export async function fetchNodeImagesForDocuments(
  options: WorkflowTargetOptions,
): Promise<{
  imageRefsPath: string;
  imagesResponsePath: string | null;
  manifestPath: string | null;
  downloadedCount: number;
  missingCount: number;
  localImagePaths: Record<string, string>;
}> {
  const outputSlug =
    options.outputSlug ??
    options.documents.map((entry) => nodeIdToSlug(entry.nodeId)).join("__");
  const sourceNodeJsons = await saveSourceNodeJsons(
    options.documents,
    options.baseDir,
    options.fileKey,
  );

  const imageRefs = Array.from(
    options.documents.reduce((acc, entry) => {
      collectImageRefs(entry.document, acc);
      return acc;
    }, new Set<string>()),
  ).sort();

  const imageRefsPath = await saveJson(
    `figma-image-refs-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      imageRefs,
    },
    { baseDir: options.baseDir },
  );

  if (imageRefs.length === 0) {
    return {
      imageRefsPath,
      imagesResponsePath: null,
      manifestPath: null,
      downloadedCount: 0,
      missingCount: 0,
      localImagePaths: {},
    };
  }

  const cachedImagesResponsePath = cachedPath(
    options.baseDir,
    `figma-file-images-${options.fileKey}.json`,
  );
  const cachedManifestPath = cachedPath(
    options.baseDir,
    `figma-downloaded-images-${options.fileKey}-${outputSlug}.json`,
  );
  if (options.useCache) {
    const manifest = await readJsonIfExists<{
      downloadedImages: Array<{ imageRef: string; outputPath: string }>;
      missingImages: string[];
    }>(cachedManifestPath);

    if (manifest && (await fileExists(cachedImagesResponsePath))) {
      const localImagePaths: Record<string, string> = {};
      let missingArtifact = false;

      for (const image of manifest.downloadedImages) {
        if (!(await fileExists(image.outputPath))) {
          missingArtifact = true;
          break;
        }
        localImagePaths[image.imageRef] = toRepoRelativePath(
          options.workspaceRoot,
          image.outputPath,
        );
      }

      if (!missingArtifact) {
        return {
          imageRefsPath,
          imagesResponsePath: cachedImagesResponsePath,
          manifestPath: cachedManifestPath,
          downloadedCount: manifest.downloadedImages.length,
          missingCount: manifest.missingImages.length,
          localImagePaths,
        };
      }
    }
  }

  const imagesResponse = await options.httpClient.getJson<{
    meta?: { images?: Record<string, string> };
    images?: Record<string, string>;
  }>({
    path: `/v1/files/${options.fileKey}/images`,
    headers: {
      "X-Figma-Token": options.token,
    },
  });
  const imagesResponsePath = await saveJson(
    `figma-file-images-${options.fileKey}.json`,
    imagesResponse,
    { baseDir: options.baseDir },
  );

  const imageMap = imagesResponse.meta?.images ?? imagesResponse.images ?? {};
  const downloadedImages: Array<{
    imageRef: string;
    contentType: string;
    outputPath: string;
    sourceUrl: string;
  }> = [];
  const missingImages: string[] = [];
  const localImagePaths: Record<string, string> = {};

  for (const imageRef of imageRefs) {
    const downloadUrl = imageMap[imageRef];
    if (typeof downloadUrl !== "string" || downloadUrl.length === 0) {
      missingImages.push(imageRef);
      continue;
    }

    try {
      const { buffer, contentType } = await options.httpClient.getBinary({
        url: downloadUrl,
      });
      const extension = extensionFromContentType(contentType);
      const outputPath = await saveBuffer(
        `figma-image-${imageRef}.${extension}`,
        buffer,
        { baseDir: options.baseDir },
      );

      downloadedImages.push({
        imageRef,
        contentType,
        outputPath,
        sourceUrl: downloadUrl,
      });
      localImagePaths[imageRef] = toRepoRelativePath(options.workspaceRoot, outputPath);
    } catch (error) {
      options.logger?.warn("Local image download failed", {
        traceId: options.traceId,
        fileKey: options.fileKey,
        imageRef,
        sourceUrl: downloadUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      missingImages.push(imageRef);
    }
  }

  const manifestPath = await saveJson(
    `figma-downloaded-images-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      imageRefsPath,
      imagesResponsePath,
      downloadedImages,
      missingImages,
    },
    { baseDir: options.baseDir },
  );

  return {
    imageRefsPath,
    imagesResponsePath,
    manifestPath,
    downloadedCount: downloadedImages.length,
    missingCount: missingImages.length,
    localImagePaths,
  };
}

export async function fetchNodeSvgForDocuments(
  options: WorkflowTargetOptions,
): Promise<{
  candidatesPath: string;
  svgUrlsPath: string;
  manifestPath: string;
  downloadedCount: number;
  missingCount: number;
  localVectorPaths: Record<string, string>;
  vectorRootMappings: Array<{
    rootNodeId: string;
    childNodeIds: string[];
    path: string;
  }>;
}> {
  const outputSlug =
    options.outputSlug ??
    options.documents.map((entry) => nodeIdToSlug(entry.nodeId)).join("__");
  const sourceNodeJsons = await saveSourceNodeJsons(
    options.documents,
    options.baseDir,
    options.fileKey,
  );

  const roots = uniqueById(
    options.documents.flatMap((entry) =>
      collectVectorExportRoots(entry.document).map((node) => ({
        node,
        id: String(node.id),
        nodeId: entry.nodeId,
      })),
    ),
  ).sort((a, b) => a.id.localeCompare(b.id));

  const candidates = roots.map(({ node }) => toVectorCandidate(node));
  const candidatesPath = await saveJson(
    `figma-vector-node-candidates-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      candidateCount: candidates.length,
      candidates,
    },
    { baseDir: options.baseDir },
  );

  let svgUrlsResponse: { err: null; images: Record<string, string> } | { images?: Record<string, string> };
  const cachedSvgUrlsPath = cachedPath(
    options.baseDir,
    `figma-vector-svg-urls-${options.fileKey}-${outputSlug}.json`,
  );
  const cachedManifestPath = cachedPath(
    options.baseDir,
    `figma-downloaded-vector-svgs-${options.fileKey}-${outputSlug}.json`,
  );
  if (options.useCache) {
    const manifest = await readJsonIfExists<{
      downloadedSvgs: Array<{
        id: string;
        outputPath: string;
        childNodeIds: string[];
        contentHash?: string;
      }>;
      missingSvgUrls: string[];
    }>(cachedManifestPath);

    if (manifest && (await fileExists(cachedSvgUrlsPath))) {
      const localVectorPaths: Record<string, string> = {};
      const vectorRootMappings: Array<{
        rootNodeId: string;
        childNodeIds: string[];
        path: string;
      }> = [];
      let missingArtifact = false;

      for (const entry of manifest.downloadedSvgs) {
        if (!(await fileExists(entry.outputPath))) {
          missingArtifact = true;
          break;
        }
        const relativePath = toRepoRelativePath(
          options.workspaceRoot,
          entry.outputPath,
        );
        localVectorPaths[entry.id] = relativePath;
        vectorRootMappings.push({
          rootNodeId: entry.id,
          childNodeIds: entry.childNodeIds,
          path: relativePath,
        });
      }

      if (!missingArtifact) {
        const uniqueOutputPathCount = new Set(
          manifest.downloadedSvgs.map((entry) => entry.outputPath),
        ).size;
        return {
          candidatesPath,
          svgUrlsPath: cachedSvgUrlsPath,
          manifestPath: cachedManifestPath,
          downloadedCount: uniqueOutputPathCount,
          missingCount: manifest.missingSvgUrls.length,
          localVectorPaths,
          vectorRootMappings,
        };
      }
    }
  }

  if (candidates.length === 0) {
    svgUrlsResponse = { err: null, images: {} };
  } else {
    options.logger?.info("Local vector asset fetch started", {
      traceId: options.traceId,
      fileKey: options.fileKey,
      outputSlug,
      candidateCount: candidates.length,
      useCache: options.useCache,
    });
    svgUrlsResponse = {
      images: await fetchSvgSignedUrls({
        fileKey: options.fileKey,
        ids: candidates.map((candidate) => candidate.id),
        token: options.token,
        httpClient: options.httpClient,
        logger: options.logger,
        traceId: options.traceId,
        flow: "localVectorDownload",
      }),
    };
  }

  const svgUrlsPath = await saveJson(
    `figma-vector-svg-urls-${options.fileKey}-${outputSlug}.json`,
    svgUrlsResponse,
    { baseDir: options.baseDir },
  );

  const downloadedSvgs: Array<{
    id: string;
    name?: string;
    type: string;
    outputPath: string;
    sourceUrl: string;
    childNodeIds: string[];
    contentHash: string;
  }> = [];
  const missingSvgUrls: string[] = [];
  const localVectorPaths: Record<string, string> = {};
  const vectorRootMappings: Array<{
    rootNodeId: string;
    childNodeIds: string[];
    path: string;
  }> = [];
  const svgPathByHash = new Map<string, string>();

  for (const root of roots) {
    const svgUrl = svgUrlsResponse.images?.[root.id];
    if (typeof svgUrl !== "string" || svgUrl.length === 0) {
      missingSvgUrls.push(root.id);
      continue;
    }

    const svgContent = await options.httpClient.getText({
      url: svgUrl,
    });
    const svgHash = createHash("sha256").update(svgContent).digest("hex");
    const outputPath =
      svgPathByHash.get(svgHash) ??
      (await saveText(
        `figma-vector-root-${nodeIdToSlug(root.id)}.svg`,
        svgContent,
        { baseDir: options.baseDir },
      ));
    svgPathByHash.set(svgHash, outputPath);
    const relativePath = toRepoRelativePath(options.workspaceRoot, outputPath);
    const childNodeIds = collectDescendantNodeIds(root.node);

    downloadedSvgs.push({
      ...toVectorCandidate(root.node),
      outputPath,
      sourceUrl: svgUrl,
      childNodeIds,
      contentHash: svgHash,
    });
    localVectorPaths[root.id] = relativePath;
    vectorRootMappings.push({
      rootNodeId: root.id,
      childNodeIds,
      path: relativePath,
    });
  }

  const manifestPath = await saveJson(
    `figma-downloaded-vector-svgs-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      candidatesPath,
      svgUrlsPath,
      downloadedSvgs,
      missingSvgUrls,
    },
    { baseDir: options.baseDir },
  );

  return {
    candidatesPath,
    svgUrlsPath,
    manifestPath,
    downloadedCount: new Set(downloadedSvgs.map((entry) => entry.outputPath)).size,
    missingCount: missingSvgUrls.length,
    localVectorPaths,
    vectorRootMappings,
  };
}

export async function fetchNodeVariablesForDocuments(
  options: WorkflowTargetOptions,
): Promise<{
  variableRefsPath: string;
  variablesResponsePath: string;
  manifestPath: string;
  variableIds: string[];
  missingVariableIds: string[];
  variablesRaw: Record<string, unknown>;
}> {
  const outputSlug =
    options.outputSlug ??
    options.documents.map((entry) => nodeIdToSlug(entry.nodeId)).join("__");
  const sourceNodeJsons = await saveSourceNodeJsons(
    options.documents,
    options.baseDir,
    options.fileKey,
  );

  const variableIds = Array.from(
    options.documents.reduce((acc, entry) => {
      collectVariableIds(entry.document, acc);
      return acc;
    }, new Set<string>()),
  ).sort();

  const variableRefsPath = await saveJson(
    `figma-node-variable-refs-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      variableIds,
    },
    { baseDir: options.baseDir },
  );

  const cachedVariablesResponsePath = cachedPath(
    options.baseDir,
    `figma-file-variables-${options.fileKey}.json`,
  );
  const cachedManifestPath = cachedPath(
    options.baseDir,
    `figma-node-variables-${options.fileKey}-${outputSlug}.json`,
  );
  if (options.useCache) {
    const variablesRaw = await readJsonIfExists<Record<string, unknown>>(cachedVariablesResponsePath);
    const manifest = await readJsonIfExists<{
      variableIds: string[];
      missingVariableIds: string[];
    }>(cachedManifestPath);

    if (variablesRaw && manifest) {
      return {
        variableRefsPath,
        variablesResponsePath: cachedVariablesResponsePath,
        manifestPath: cachedManifestPath,
        variableIds: manifest.variableIds,
        missingVariableIds: manifest.missingVariableIds,
        variablesRaw,
      };
    }
  }

  const variablesResponse = await options.httpClient.getJson<Record<string, unknown>>({
    path: `/v1/files/${options.fileKey}/variables/local`,
    headers: {
      "X-Figma-Token": options.token,
    },
  });
  const variablesResponsePath = await saveJson(
    `figma-file-variables-${options.fileKey}.json`,
    variablesResponse,
    { baseDir: options.baseDir },
  );

  const variablesMap =
    (
      variablesResponse.meta as { variables?: Record<string, unknown> } | undefined
    )?.variables ?? {};
  const collectionsMap =
    (
      variablesResponse.meta as {
        variableCollections?: Record<string, unknown>;
      } | undefined
    )?.variableCollections ?? {};

  const resolvedVariables = variableIds.map((variableId) => {
    const variable = variablesMap[variableId] ?? null;
    const variableCollection =
      variable &&
      typeof variable === "object" &&
      typeof (variable as { variableCollectionId?: unknown }).variableCollectionId ===
        "string"
        ? collectionsMap[
            (variable as { variableCollectionId: string }).variableCollectionId
          ] ?? null
        : null;

    return {
      variableId,
      found: variable !== null,
      variable,
      variableCollection,
    };
  });

  const missingVariableIds = resolvedVariables
    .filter((entry) => entry.found === false)
    .map((entry) => entry.variableId);

  const manifestPath = await saveJson(
    `figma-node-variables-${options.fileKey}-${outputSlug}.json`,
    {
      fileKey: options.fileKey,
      nodeIds: options.documents.map((entry) => entry.nodeId),
      sourceNodeJsons,
      variableRefsPath,
      variablesResponsePath,
      variableIds,
      resolvedVariables,
      missingVariableIds,
    },
    { baseDir: options.baseDir },
  );

  return {
    variableRefsPath,
    variablesResponsePath,
    manifestPath,
    variableIds,
    missingVariableIds,
    variablesRaw: variablesResponse,
  };
}

export async function fetchNodeImagesForTarget(
  options: Omit<WorkflowTargetOptions, "documents"> & {
    nodeId: string;
    document: Record<string, unknown>;
  },
) {
  return await fetchNodeImagesForDocuments({
    fileKey: options.fileKey,
    documents: [{ nodeId: options.nodeId, document: options.document }],
    baseDir: options.baseDir,
    workspaceRoot: options.workspaceRoot,
    useCache: options.useCache,
    token: options.token,
    httpClient: options.httpClient,
    outputSlug: nodeIdToSlug(options.nodeId),
  });
}

export async function fetchNodeSvgForTarget(
  options: Omit<WorkflowTargetOptions, "documents"> & {
    nodeId: string;
    document: Record<string, unknown>;
  },
) {
  return await fetchNodeSvgForDocuments({
    fileKey: options.fileKey,
    documents: [{ nodeId: options.nodeId, document: options.document }],
    baseDir: options.baseDir,
    workspaceRoot: options.workspaceRoot,
    useCache: options.useCache,
    token: options.token,
    httpClient: options.httpClient,
    outputSlug: nodeIdToSlug(options.nodeId),
  });
}

export async function fetchNodeVariablesForTarget(
  options: Omit<WorkflowTargetOptions, "documents"> & {
    nodeId: string;
    document: Record<string, unknown>;
  },
) {
  return await fetchNodeVariablesForDocuments({
    fileKey: options.fileKey,
    documents: [{ nodeId: options.nodeId, document: options.document }],
    baseDir: options.baseDir,
    workspaceRoot: options.workspaceRoot,
    useCache: options.useCache,
    token: options.token,
    httpClient: options.httpClient,
    outputSlug: nodeIdToSlug(options.nodeId),
  });
}
