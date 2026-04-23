import type { StyledTextSegmentSubset } from "../pluginTypes.js";
import type { KernelSourceSnapshot } from "../types.js";
import { deriveTextSegmentsFromRestNode } from "./restNodeUtils.js";

const MIXED = Symbol.for("figma-source-snapshot-adapter.mixed");

type SnapshotSceneNode = SceneNode & {
  parent?: SnapshotSceneNode | null;
  children?: SnapshotSceneNode[];
  exportAsync?: (
    settings:
      | ExportSettings
      | ExportSettingsSVGString
      | ExportSettingsREST
      | undefined,
  ) => Promise<unknown>;
  getStyledTextSegments?: (fields?: string[]) => StyledTextSegmentSubset[];
  localImagePath?: string;
  localVectorPath?: string;
  isLocalVectorChild?: boolean;
  localVectorRootId?: string;
  canBeFlattened?: boolean;
};

function cloneJson<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function collectNodeMap(
  node: Record<string, unknown>,
  nodeMap = new Map<string, Record<string, unknown>>(),
): Map<string, Record<string, unknown>> {
  if (typeof node.id !== "string") {
    return nodeMap;
  }

  nodeMap.set(node.id, node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === "object") {
        collectNodeMap(child as Record<string, unknown>, nodeMap);
      }
    }
  }

  return nodeMap;
}

function collectPaints(node: unknown, paints: Paint[] = []): Paint[] {
  if (!node || typeof node !== "object") {
    return paints;
  }

  if (Array.isArray((node as { fills?: unknown }).fills)) {
    paints.push(...cloneJson((node as { fills: Paint[] }).fills));
  }

  if (Array.isArray((node as { strokes?: unknown }).strokes)) {
    paints.push(...cloneJson((node as { strokes: Paint[] }).strokes));
  }

  if (Array.isArray((node as { children?: unknown }).children)) {
    for (const child of (node as { children: unknown[] }).children) {
      collectPaints(child, paints);
    }
  }

  return paints;
}

function toVariablesState(variablesRaw: unknown): {
  variableMap: Record<string, Variable>;
  variableCollections: Record<string, VariableCollection>;
} {
  const raw =
    variablesRaw && typeof variablesRaw === "object"
      ? (variablesRaw as {
          meta?: {
            variables?: Record<string, Variable>;
            variableCollections?: Record<string, VariableCollection>;
          };
          variables?: Record<string, Variable>;
          variableCollections?: Record<string, VariableCollection>;
        })
      : undefined;

  return {
    variableMap: raw?.meta?.variables ?? raw?.variables ?? {},
    variableCollections:
      raw?.meta?.variableCollections ?? raw?.variableCollections ?? {},
  };
}

class SnapshotImageHandle {
  constructor(private readonly imageUrl: string) {}

  async getBytesAsync(): Promise<Uint8Array> {
    if (this.imageUrl.startsWith("data:")) {
      const payload = this.imageUrl.slice(this.imageUrl.indexOf(",") + 1);
      return Uint8Array.from(Buffer.from(payload, "base64"));
    }

    throw new Error(
      `Binary image bytes are unavailable for ${this.imageUrl}. Only data URLs are supported in the snapshot adapter.`,
    );
  }
}

class SnapshotVariablesApi {
  constructor(private readonly variableMap: Record<string, Variable>) {}

  getVariableById(id: string) {
    return this.variableMap[id] ?? null;
  }

  async getVariableByIdAsync(id: string) {
    return this.variableMap[id] ?? null;
  }
}

export type SnapshotPluginApiAdapter = Awaited<
  ReturnType<typeof createSourceSnapshotPluginApiAdapter>
>;

export async function createSourceSnapshotPluginApiAdapter(input: {
  snapshot: KernelSourceSnapshot;
}) {
  const { snapshot } = input;
  const rawNodeById = new Map<string, Record<string, unknown>>();
  const decoratedNodeById = new Map<string, SnapshotSceneNode>();
  const textSegmentsCache = new Map<string, StyledTextSegmentSubset[]>();
  const localVectorRoots = new Map(
    (snapshot.localVectorRootMappings ?? []).map((mapping) => [
      mapping.rootNodeId,
      mapping,
    ]),
  );
  const localVectorChildren = new Map<string, string>();
  const { variableMap } = toVariablesState(snapshot.variablesRaw);

  for (const mapping of snapshot.localVectorRootMappings ?? []) {
    for (const childNodeId of mapping.childNodeIds) {
      localVectorChildren.set(childNodeId, mapping.rootNodeId);
    }
  }

  const adapter = {
    mixed: MIXED as unknown as PluginAPI["mixed"],
    variables: new SnapshotVariablesApi(variableMap),
    currentPage: {
      selection: [] as SnapshotSceneNode[],
    },
    async getNodeByIdAsync(nodeId: string) {
      return decoratedNodeById.get(nodeId) ?? null;
    },
    getSelectionColors() {
      const paints: Paint[] = [];
      for (const selectionNode of adapter.currentPage.selection) {
        collectPaints(selectionNode, paints);
      }
      return { paints, styles: [] };
    },
    getImageByHash(imageHash: string) {
      const imageUrl = snapshot.imageUrls[imageHash];
      if (!imageUrl) {
        throw new Error(`No image URL was found for imageRef ${imageHash}`);
      }
      return new SnapshotImageHandle(imageUrl);
    },
  };

  const decorateNode = (
    rawNode: Record<string, unknown>,
    parentNode: SnapshotSceneNode | null,
  ): SnapshotSceneNode => {
    const nodeId = rawNode.id;
    if (typeof nodeId !== "string") {
      return rawNode as unknown as SnapshotSceneNode;
    }

    if (decoratedNodeById.has(nodeId)) {
      return decoratedNodeById.get(nodeId)!;
    }

    const decorated = cloneJson(rawNode) as unknown as SnapshotSceneNode;

    (decorated as unknown as { parent?: SnapshotSceneNode | null }).parent = parentNode;
    (decorated as unknown as { exportAsync?: SnapshotSceneNode["exportAsync"] }).exportAsync =
      (async (
        settings?:
          | ExportSettings
          | ExportSettingsSVGString
          | ExportSettingsREST,
      ) => {
        if (!settings) {
          throw new Error(
            `An explicit export format is required for node ${nodeId} in the snapshot adapter.`,
          );
        }

        if (settings.format === "JSON_REST_V1") {
          return {
            document: cloneJson(rawNode),
          };
        }

        if (settings.format === "SVG_STRING") {
          const svg = snapshot.vectorUrls[nodeId];
          if (!svg) {
            throw new Error(`No SVG content was found for node ${nodeId}`);
          }
          return svg;
        }

        if (settings.format === "PNG") {
          throw new Error(
            `PNG export is unavailable for node ${nodeId} in the snapshot adapter.`,
          );
        }

        throw new Error(`Unsupported export format: ${String(settings.format)}`);
      }) as unknown as SnapshotSceneNode["exportAsync"];
    (decorated as unknown as {
      getStyledTextSegments?: SnapshotSceneNode["getStyledTextSegments"];
    }).getStyledTextSegments = (fields?: string[]) => {
      if (!textSegmentsCache.has(nodeId)) {
        textSegmentsCache.set(
          nodeId,
          deriveTextSegmentsFromRestNode(rawNode),
        );
      }

      const segments = textSegmentsCache.get(nodeId) ?? [];
      if (!fields || fields.length === 0) {
        return cloneJson(segments);
      }

      return segments.map((segment) => {
        const result: Record<string, unknown> = {
          characters: segment.characters,
          start: segment.start,
          end: segment.end,
        };

        for (const field of fields) {
          if (field in segment) {
            result[field] = cloneJson(
              segment[field as keyof StyledTextSegmentSubset],
            );
          }
        }

        return result as StyledTextSegmentSubset;
      });
    };

    if (Array.isArray(rawNode.fills)) {
      const localImageFill = rawNode.fills.find(
        (fill) =>
          fill &&
          typeof fill === "object" &&
          typeof (fill as { imageRef?: unknown }).imageRef === "string" &&
          snapshot.localImagePaths?.[
            (fill as { imageRef: string }).imageRef
          ],
      ) as { imageRef?: string } | undefined;
      if (localImageFill?.imageRef) {
        (decorated as unknown as { localImagePath?: string }).localImagePath =
          snapshot.localImagePaths?.[localImageFill.imageRef];
      }
    }

    const localVectorRoot = localVectorRoots.get(nodeId);
    if (localVectorRoot) {
      (decorated as unknown as { localVectorPath?: string }).localVectorPath =
        localVectorRoot.path;
      (decorated as unknown as { canBeFlattened?: boolean }).canBeFlattened = true;
    }

    const localVectorRootId = localVectorChildren.get(nodeId);
    if (localVectorRootId) {
      (decorated as unknown as {
        isLocalVectorChild?: boolean;
        localVectorRootId?: string;
      }).isLocalVectorChild = true;
      (decorated as unknown as {
        isLocalVectorChild?: boolean;
        localVectorRootId?: string;
      }).localVectorRootId = localVectorRootId;
    }

    decoratedNodeById.set(nodeId, decorated);

    if (Array.isArray(rawNode.children)) {
      (decorated as unknown as { children?: SnapshotSceneNode[] }).children =
        rawNode.children.map((child) =>
          decorateNode(child as Record<string, unknown>, decorated),
        );
    }

    return decorated;
  };

  for (const sourceNode of snapshot.sourceNodes) {
    collectNodeMap(sourceNode.document, rawNodeById);
  }

  adapter.currentPage.selection = snapshot.sourceNodes.map((sourceNode) =>
    decorateNode(sourceNode.document, null),
  );

  return adapter;
}
