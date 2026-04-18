import type {
  CapabilitiesRequest,
  CapabilitiesResponse,
  ConvertRequest,
  ConvertResponse,
  ConversionOptions,
  GenerationMode,
  SourceSnapshot,
} from "../core/contracts.js";
import type {
  AssetMaterializer,
  CapabilityProbe,
  CodeGenerator,
  CodeArtifactWriter,
  ConvertExecutionHooks,
  ConvertProgressStage,
  DiagnosticsBuilder,
  Normalizer,
  PreviewGenerator,
  SnapshotAdapter,
  SourceGateway,
  SourceResolver,
} from "../core/interfaces.js";
import type { Tracer } from "../infrastructure/tracer.js";
import { withRequestCache } from "../infrastructure/cache.js";
import { createRequestContext } from "./requestContext.js";
import type { Metrics } from "../infrastructure/metrics.js";
import { noopMetrics } from "../infrastructure/metrics.js";
import { resolveWorkspaceRoot } from "../infrastructure/workspacePaths.js";

function getConvertProgressTotal(includeDiagnostics: boolean): number {
  return 9 + Number(includeDiagnostics);
}

function resolveGenerationModeOptions(
  framework: ConvertRequest["framework"],
  generationMode: GenerationMode | undefined,
): Partial<ConversionOptions> {
  if (!generationMode) {
    return {};
  }

  switch (framework) {
    case "HTML":
      if (
        generationMode === "html" ||
        generationMode === "jsx" ||
        generationMode === "styled-components" ||
        generationMode === "svelte"
      ) {
        return { htmlGenerationMode: generationMode };
      }
      return {};
    case "Tailwind":
      if (
        generationMode === "html" ||
        generationMode === "jsx" ||
        generationMode === "twig"
      ) {
        return { tailwindGenerationMode: generationMode };
      }
      return {};
    case "Flutter":
      if (
        generationMode === "fullApp" ||
        generationMode === "stateless" ||
        generationMode === "snippet"
      ) {
        return { flutterGenerationMode: generationMode };
      }
      return {};
    case "SwiftUI":
      if (
        generationMode === "preview" ||
        generationMode === "struct" ||
        generationMode === "snippet"
      ) {
        return { swiftUIGenerationMode: generationMode };
      }
      return {};
    case "Compose":
      if (
        generationMode === "snippet" ||
        generationMode === "composable" ||
        generationMode === "screen"
      ) {
        return { composeGenerationMode: generationMode };
      }
      return {};
  }
}

export class ConvertFigmaNodeUseCase {
  constructor(
    private readonly tracer: Tracer,
    private readonly sourceResolver: SourceResolver,
    private readonly capabilityProbe: CapabilityProbe,
    private readonly sourceGateway: SourceGateway,
    private readonly snapshotAdapter: SnapshotAdapter,
    private readonly assetMaterializer: AssetMaterializer,
    private readonly normalizer: Normalizer,
    private readonly codeGenerator: CodeGenerator,
    private readonly codeArtifactWriter: CodeArtifactWriter,
    private readonly previewGenerator: PreviewGenerator,
    private readonly diagnosticsBuilder: DiagnosticsBuilder,
    private readonly defaultConversionOptions: Omit<ConversionOptions, "framework">,
    private readonly metrics: Metrics = noopMetrics,
  ) {}

  async execute(
    request: ConvertRequest,
    hooks?: ConvertExecutionHooks,
  ): Promise<ConvertResponse> {
    return await withRequestCache(async () => {
      const startedAt = Date.now();
      let context: ReturnType<typeof createRequestContext> | undefined;
      const totalProgress = getConvertProgressTotal(
        this.defaultConversionOptions.includeDiagnostics === true,
      );
      let progress = 0;
      const reportProgress = async (
        stage: ConvertProgressStage,
        message: string,
      ): Promise<void> => {
        await hooks?.onProgress?.({
          stage,
          progress,
          total: totalProgress,
          message,
        });
      };
      const advanceProgress = async (
        stage: ConvertProgressStage,
        message: string,
      ): Promise<void> => {
        progress += 1;
        await reportProgress(stage, message);
      };
      this.metrics.increment("figma_convert_request_total", 1, {
        framework: request.framework,
      });

      try {
        await reportProgress("resolve_source", "Resolving source");
        const rawServiceCapabilitySnapshot =
          await this.capabilityProbe.getServiceSnapshot();
        const serviceCapabilitySnapshot = this.capabilityProbe.scopeForFramework(
          rawServiceCapabilitySnapshot,
          request.framework,
        );
        const workspace = {
          workspaceRoot: resolveWorkspaceRoot(request.workspaceRoot ?? process.cwd()),
          useCache: request.useCache ?? false,
        };
        const requestContext = createRequestContext({
          traceId: this.tracer.createTraceId(),
          options: {
            framework: request.framework,
            ...this.defaultConversionOptions,
            ...resolveGenerationModeOptions(request.framework, request.generationMode),
            returnPreview: false,
            includeDiagnostics: this.defaultConversionOptions.includeDiagnostics,
          },
          workspace,
          serviceCapabilitySnapshot,
        });
        context = requestContext;

        const target = await requestContext.stageTimer.measure("resolve_source", () =>
          this.sourceResolver.resolve(request.figmaUrl),
        );
        await advanceProgress("fetch_nodes", "Fetching node data");

        const snapshot = await requestContext.stageTimer.measure(
          "fetch_snapshot",
          async (): Promise<SourceSnapshot> => {
            let requestCount = 0;
            const gatewayNodes = await this.sourceGateway.fetchNodes(
              target,
              requestContext.workspace,
            );
            requestCount += 1;
            await advanceProgress("fetch_images", "Fetching image resources");
            const images = await this.fetchOptionalAssets("images", requestContext, async () => {
              requestCount += 1;
              return await this.sourceGateway.fetchImages(
                target.fileKey,
                requestContext.workspace,
              );
            });
            let nextSnapshot = this.snapshotAdapter.build(
              target,
              gatewayNodes,
              images,
              {},
              undefined,
              requestCount,
            );
            await advanceProgress("fetch_vectors", "Fetching vector resources");
            const vectors = await this.fetchOptionalAssets(
              "vectors",
              requestContext,
              async () => {
                requestCount += 1;
                return await this.sourceGateway.fetchVectors(
                  target.fileKey,
                  nextSnapshot.vectorCandidates.map((candidate) => candidate.id),
                  requestContext.workspace,
                );
              },
            );
            await advanceProgress("fetch_variables", "Fetching variable metadata");
            let variablesRaw: unknown;
            try {
              requestCount += 1;
              variablesRaw = await this.sourceGateway.fetchVariables(
                target.fileKey,
                requestContext.workspace,
              );
            } catch (error) {
              requestCount -= 1;
              throw error;
            }
            nextSnapshot = this.snapshotAdapter.build(
              target,
              gatewayNodes,
              images,
              vectors,
              variablesRaw,
              requestCount,
            );
            await advanceProgress("materialize_assets", "Downloading local assets");
            nextSnapshot = await this.assetMaterializer.materialize({
              target,
              gatewayData: gatewayNodes,
              snapshot: nextSnapshot,
              context: requestContext,
            });

            return nextSnapshot;
          },
        );
        requestContext.sourceSnapshot = snapshot;

        requestContext.requestCapabilitySnapshot = await requestContext.stageTimer.measure(
          "probe_capabilities",
          async () => {
            const base = this.capabilityProbe.enrichForRequest(
              serviceCapabilitySnapshot,
              snapshot,
            );
            if (this.capabilityProbe.enrichWithVariableProbe) {
              return await this.capabilityProbe.enrichWithVariableProbe(
                base,
                target.fileKey,
                requestContext.workspace,
              );
            }
            return base;
          },
        );

        await advanceProgress("normalize", "Normalizing node tree");
        const tree = await requestContext.stageTimer.measure("normalize", () =>
          this.normalizer.normalize(snapshot, requestContext),
        );

        await advanceProgress("generate_code", "Generating code");
        let artifact = await requestContext.stageTimer.measure("generate_code", () =>
          this.codeGenerator.generate(tree, requestContext),
        );

        await advanceProgress("write_artifact", "Writing cached artifacts");
        artifact = await this.codeArtifactWriter.write(artifact, requestContext);

        const diagnostics =
          requestContext.options.includeDiagnostics !== true
            ? undefined
            : await (async () => {
                await advanceProgress("build_diagnostics", "Building diagnostics");
                return await requestContext.stageTimer.measure("build_diagnostics", () =>
                  this.diagnosticsBuilder.build(requestContext, snapshot, artifact),
                );
              })();

        this.metrics.increment("figma_convert_success_total", 1, {
          framework: artifact.framework,
        });
        this.recordStageTimings(requestContext, artifact.framework);
        this.metrics.timing("figma_convert_total_ms", Date.now() - startedAt, {
          framework: artifact.framework,
        });
        await advanceProgress("complete", "Conversion complete");

        return {
          framework: artifact.framework,
          code: artifact.code,
          warnings: requestContext.warningCollector.list(),
          preview: artifact.preview,
          diagnostics,
        };
      } catch (error) {
        this.metrics.increment("figma_convert_error_total", 1, {
          framework: request.framework,
          stage:
            error && typeof error === "object" && "stage" in error
              ? String((error as { stage?: unknown }).stage)
              : "unknown",
        });
        if (context) {
          this.recordStageTimings(context, request.framework);
        }
        this.metrics.timing("figma_convert_total_ms", Date.now() - startedAt, {
          framework: request.framework,
        });
        throw error;
      }
    });
  }

  private recordStageTimings(
    context: ReturnType<typeof createRequestContext>,
    framework: string,
  ): void {
    const timings = context.stageTimer.snapshot();
    for (const [stage, ms] of Object.entries(timings)) {
      if (ms > 0) {
        this.metrics.timing("figma_convert_stage_ms", ms, {
          framework,
          stage,
        });
      }
    }
  }

  private async fetchOptionalAssets(
    feature: "images" | "vectors",
    context: ReturnType<typeof createRequestContext>,
    load: () => Promise<Record<string, string>>,
  ): Promise<Record<string, string>> {
    try {
      return await load();
    } catch (error) {
      const reason = `${feature.slice(0, -1)}_fetch_failed`;
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
        `${feature} fetch failed and the conversion continued without embedded ${feature}.`,
      );
      context.warningCollector.add(reason);
      return {};
    }
  }
}

export class GetCapabilitiesUseCase {
  constructor(private readonly capabilityProbe: CapabilityProbe) {}

  async execute(request: CapabilitiesRequest): Promise<CapabilitiesResponse> {
    const rawSnapshot = await this.capabilityProbe.getServiceSnapshot();
    const snapshot = request.framework
      ? this.capabilityProbe.scopeForFramework(rawSnapshot, request.framework)
      : rawSnapshot;
    return {
      frameworks: request.framework
        ? snapshot.frameworks.filter((item) => item.name === request.framework)
        : snapshot.frameworks,
      features: snapshot.features,
      limits: snapshot.limits,
    };
  }
}
