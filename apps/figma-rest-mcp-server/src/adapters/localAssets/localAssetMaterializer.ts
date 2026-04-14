import { resolve } from "node:path";
import type { RequestContext } from "../../application/requestContext.js";
import type { SourceSnapshot } from "../../core/contracts.js";
import type { AssetMaterializer } from "../../core/interfaces.js";
import type { AppConfig } from "../../infrastructure/config.js";
import type { HttpClient } from "../../infrastructure/httpClient.js";
import type { Logger } from "../../infrastructure/logger.js";
import type { TokenProvider } from "../../infrastructure/tokenProvider.js";
import {
  resolveLocalAssetOutputDir,
  toWorkspaceRelativePath,
} from "../../infrastructure/workspacePaths.js";
import { nodeIdToSlug } from "./figmaScriptCommon.js";
import {
  fetchNodeImagesForDocuments,
  fetchNodeSvgForDocuments,
  fetchNodeVariablesForDocuments,
} from "./figmaWorkflow.js";

function addLocalAssetFailureWarning(
  context: RequestContext,
  feature: "images" | "vectors",
  reason: string,
): void {
  context.warningCollector.addDegradation({
    feature,
    stage: "fetch_snapshot",
    reason,
    affectsCorrectness: false,
    affectsFidelity: true,
  });
  context.warningCollector.addDecision(
    feature,
    true,
    false,
    context.serviceCapabilitySnapshot.features[feature],
    "fetch_snapshot",
    `Local ${feature} download failed and the conversion continued with the existing asset flow.`,
  );
  context.warningCollector.add(reason);
}

function clearRecoveredFetchWarning(
  context: RequestContext,
  feature: "images" | "vectors",
): void {
  const warningReason = `${feature.slice(0, -1)}_fetch_failed`;
  const decisionReason =
    `${feature} fetch failed and the conversion continued without embedded ${feature}.`;

  context.warningCollector.remove(warningReason);
  context.warningCollector.removeDegradations((record) =>
    record.feature === feature &&
    record.stage === "fetch_snapshot" &&
    record.reason === warningReason
  );
  context.warningCollector.removeDecisions((decision) =>
    decision.feature === feature &&
    decision.stage === "fetch_snapshot" &&
    decision.reason === decisionReason
  );
}

function addVariableFailureWarning(
  context: RequestContext,
  reason: string,
): void {
  context.warningCollector.addDegradation({
    feature: "colorVariables",
    stage: "fetch_snapshot",
    reason,
    affectsCorrectness: false,
    affectsFidelity: true,
  });
  context.warningCollector.addDecision(
    "colorVariables",
    true,
    false,
    context.serviceCapabilitySnapshot.features.colorVariables,
    "fetch_snapshot",
    "Color variable metadata fetch failed and the conversion continued without resolved variable names.",
  );
  context.warningCollector.add(reason);
}

function toRelativeManifestPath(
  context: RequestContext,
  path: string | undefined | null,
): string | undefined {
  if (!path) {
    return undefined;
  }
  return toWorkspaceRelativePath(context.workspace.workspaceRoot, path);
}

export class LocalAssetMaterializer implements AssetMaterializer {
  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient,
    private readonly tokenProvider: TokenProvider,
    private readonly logger: Logger,
  ) {}

  async materialize({
    target,
    gatewayData,
    snapshot,
    context,
  }: Parameters<AssetMaterializer["materialize"]>[0]): Promise<SourceSnapshot> {
    const downloadImagesToLocal = context.options.downloadImagesToLocal === true;
    const downloadVectorsToLocal = context.options.downloadVectorsToLocal === true;

    if (!downloadImagesToLocal && !downloadVectorsToLocal) {
      return snapshot;
    }

    const outputSlug = target.nodeIds.map((nodeId) => nodeIdToSlug(nodeId)).join("__");
    const baseDir = resolve(
      resolveLocalAssetOutputDir(context.workspace.workspaceRoot),
      target.fileKey,
      outputSlug,
    );
    const token = this.tokenProvider.getToken();

    let nextSnapshot: SourceSnapshot = snapshot;

    try {
        const result = await fetchNodeVariablesForDocuments({
          fileKey: target.fileKey,
          documents: gatewayData.documents,
          baseDir,
          workspaceRoot: context.workspace.workspaceRoot,
          useCache: context.workspace.useCache,
          token,
          httpClient: this.httpClient,
          outputSlug,
        });
      nextSnapshot = {
        ...nextSnapshot,
        variablesRaw: result.variablesRaw,
          localAssetManifestPaths: {
            ...(nextSnapshot.localAssetManifestPaths ?? {}),
            variableRefsPath: toRelativeManifestPath(context, result.variableRefsPath),
            variablesResponsePath: toRelativeManifestPath(context, result.variablesResponsePath),
            variableManifestPath: toRelativeManifestPath(context, result.manifestPath),
          },
        };
    } catch (error) {
      this.logger.warn("Variable materialization failed", {
        fileKey: target.fileKey,
        nodeIds: target.nodeIds,
        error: error instanceof Error ? error.message : String(error),
      });
      addVariableFailureWarning(context, "color_variable_fetch_failed");
    }

    if (downloadImagesToLocal) {
      try {
        const result = await fetchNodeImagesForDocuments({
          fileKey: target.fileKey,
          documents: gatewayData.documents,
          baseDir,
          workspaceRoot: context.workspace.workspaceRoot,
          useCache: context.workspace.useCache,
          token,
          httpClient: this.httpClient,
          outputSlug,
        });
        nextSnapshot = {
          ...nextSnapshot,
          localImagePaths: {
            ...(nextSnapshot.localImagePaths ?? {}),
            ...result.localImagePaths,
          },
          localAssetManifestPaths: {
            ...(nextSnapshot.localAssetManifestPaths ?? {}),
            imageRefsPath: toRelativeManifestPath(context, result.imageRefsPath),
            imagesResponsePath: toRelativeManifestPath(context, result.imagesResponsePath),
            imageManifestPath: toRelativeManifestPath(context, result.manifestPath),
          },
        };
        if (result.downloadedCount > 0 && result.missingCount === 0) {
          clearRecoveredFetchWarning(context, "images");
        }
      } catch (error) {
        this.logger.warn("Local image materialization failed", {
          fileKey: target.fileKey,
          nodeIds: target.nodeIds,
          error: error instanceof Error ? error.message : String(error),
        });
        addLocalAssetFailureWarning(
          context,
          "images",
          "local_image_download_failed",
        );
      }
    }

    if (downloadVectorsToLocal) {
      try {
        this.logger.info("Local vector materialization started", {
          traceId: context.traceId,
          fileKey: target.fileKey,
          nodeIds: target.nodeIds,
          workspaceRoot: context.workspace.workspaceRoot,
          useCache: context.workspace.useCache,
        });
        const result = await fetchNodeSvgForDocuments({
          fileKey: target.fileKey,
          documents: gatewayData.documents,
          baseDir,
          workspaceRoot: context.workspace.workspaceRoot,
          useCache: context.workspace.useCache,
          token,
          httpClient: this.httpClient,
          logger: this.logger,
          traceId: context.traceId,
          outputSlug,
        });
        this.logger.info("Local vector materialization completed", {
          traceId: context.traceId,
          fileKey: target.fileKey,
          nodeIds: target.nodeIds,
          downloadedCount: result.downloadedCount,
          missingCount: result.missingCount,
          vectorRootCount: result.vectorRootMappings.length,
        });
        nextSnapshot = {
          ...nextSnapshot,
          localVectorPaths: {
            ...(nextSnapshot.localVectorPaths ?? {}),
            ...result.localVectorPaths,
          },
          localVectorRootMappings: [
            ...(nextSnapshot.localVectorRootMappings ?? []),
            ...result.vectorRootMappings,
          ],
          localAssetManifestPaths: {
            ...(nextSnapshot.localAssetManifestPaths ?? {}),
            vectorCandidatesPath: toRelativeManifestPath(context, result.candidatesPath),
            vectorSvgUrlsPath: toRelativeManifestPath(context, result.svgUrlsPath),
            vectorManifestPath: toRelativeManifestPath(context, result.manifestPath),
          },
        };
        if (result.downloadedCount > 0 && result.missingCount === 0) {
          clearRecoveredFetchWarning(context, "vectors");
        }
      } catch (error) {
        this.logger.warn("Local vector materialization failed", {
          traceId: context.traceId,
          fileKey: target.fileKey,
          nodeIds: target.nodeIds,
          error: error instanceof Error ? error.message : String(error),
          errorCode:
            error && typeof error === "object" && "code" in error
              ? String((error as { code?: unknown }).code)
              : undefined,
          errorCategory:
            error && typeof error === "object" && "category" in error
              ? String((error as { category?: unknown }).category)
              : undefined,
        });
        addLocalAssetFailureWarning(
          context,
          "vectors",
          "local_vector_download_failed",
        );
      }
    }

    return nextSnapshot;
  }
}
