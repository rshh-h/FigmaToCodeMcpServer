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

function validateStartupConfig(config: ReturnType<typeof readConfig>) {
  if (!config.FIGMA_ACCESS_TOKEN) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN is required to start figma-to-code-mcp-server.",
    );
  }
}

export function createApplication(env: NodeJS.ProcessEnv = process.env) {
  const config = readConfig(env);
  validateStartupConfig(config);
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
