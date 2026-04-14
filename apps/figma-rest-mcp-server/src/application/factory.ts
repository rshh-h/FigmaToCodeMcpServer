import { CapabilityProbeAdapter } from "../adapters/capabilityProbe.js";
import { FigmaRestGateway } from "../adapters/figmaRestGateway.js";
import { GeneratorAdapter } from "../adapters/generatorAdapter.js";
import { FileCodeArtifactWriter } from "../adapters/fileCodeArtifactWriter.js";
import { LocalAssetMaterializer } from "../adapters/localAssets/localAssetMaterializer.js";
import { NormalizationAdapter } from "../adapters/normalizer.js";
import { PreviewAdapter } from "../adapters/previewAdapter.js";
import { SourceSnapshotAdapter } from "../adapters/sourceSnapshotAdapter.js";
import { FigmaLinkParserAdapter } from "../adapters/sourceResolver.js";
import { DefaultDiagnosticsBuilder } from "./diagnosticsBuilder.js";
import { ConvertFigmaNodeUseCase, GetCapabilitiesUseCase } from "./useCases.js";
import { readConfig } from "../infrastructure/config.js";
import { HttpClient } from "../infrastructure/httpClient.js";
import { stderrLogger } from "../infrastructure/logger.js";
import {
  createLoggingMetrics,
  noopMetrics,
} from "../infrastructure/metrics.js";
import { RateLimitGate } from "../infrastructure/rateLimitGate.js";
import { TokenProvider } from "../infrastructure/tokenProvider.js";
import { uuidTracer } from "../infrastructure/tracer.js";
import type { ConversionOptions } from "../core/contracts.js";

function validateStartupConfig(config: ReturnType<typeof readConfig>) {
  if (!config.FIGMA_ACCESS_TOKEN) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN is required to start figma-to-code-mcp-server.",
    );
  }
}

function createDefaultConversionOptions(
  config: ReturnType<typeof readConfig>,
): Omit<ConversionOptions, "framework"> {
  return {
    showLayerNames: config.SHOW_LAYER_NAMES,
    useColorVariables: config.ENABLE_VARIABLES,
    embedImages: config.ENABLE_IMAGE_EMBED,
    embedVectors: config.ENABLE_VECTOR_EMBED,
    roundTailwindValues: config.ROUND_TAILWIND_VALUES,
    roundTailwindColors: config.ROUND_TAILWIND_COLORS,
    customTailwindPrefix: config.CUSTOM_TAILWIND_PREFIX,
    useTailwind4: config.USE_TAILWIND4,
    baseFontSize: config.BASE_FONT_SIZE,
    thresholdPercent: config.THRESHOLD_PERCENT,
    baseFontFamily: config.BASE_FONT_FAMILY,
    fontFamilyCustomConfig: config.FONT_FAMILY_CUSTOM_CONFIG,
    downloadImagesToLocal: config.DOWNLOAD_IMAGES_TO_LOCAL,
    downloadVectorsToLocal: config.DOWNLOAD_VECTORS_TO_LOCAL,
    returnPreview: false,
  };
}

export function createApplication(env: NodeJS.ProcessEnv = process.env) {
  const config = readConfig(env);
  validateStartupConfig(config);
  const defaultConversionOptions = createDefaultConversionOptions(config);
  const metrics = config.ENABLE_METRICS_LOGGING
    ? createLoggingMetrics(stderrLogger)
    : noopMetrics;
  const tokenProvider = new TokenProvider(config);
  const rateLimitGate = new RateLimitGate(config.HTTP_MAX_CONCURRENCY);
  const httpClient = new HttpClient({
    baseUrl: config.FIGMA_API_BASE_URL,
    timeoutMs: config.HTTP_TIMEOUT_MS,
    retryMax: config.HTTP_RETRY_MAX,
    logger: stderrLogger,
    metrics,
    gate: rateLimitGate,
  });

  const gateway = new FigmaRestGateway(
    config,
    httpClient,
    tokenProvider,
    stderrLogger,
    metrics,
  );
  const capabilityProbe = new CapabilityProbeAdapter(config, gateway);

  const convertUseCase = new ConvertFigmaNodeUseCase(
    uuidTracer,
    new FigmaLinkParserAdapter(),
    capabilityProbe,
    gateway,
    new SourceSnapshotAdapter(),
    new LocalAssetMaterializer(config, httpClient, tokenProvider, stderrLogger),
    new NormalizationAdapter(),
    new GeneratorAdapter(),
    new FileCodeArtifactWriter(),
    new PreviewAdapter(),
    new DefaultDiagnosticsBuilder(),
    defaultConversionOptions,
    metrics,
  );

  const capabilitiesUseCase = new GetCapabilitiesUseCase(capabilityProbe);

  return {
    config,
    startup: async () => {
      await capabilityProbe.getServiceSnapshot();
    },
    convertUseCase,
    capabilitiesUseCase,
  };
}
