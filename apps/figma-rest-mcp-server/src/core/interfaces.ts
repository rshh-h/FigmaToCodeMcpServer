import type {
  CapabilitySnapshot,
  ConversionArtifact,
  ConversionOptions,
  ConvertRequest,
  DiagnosticsReport,
  FetchScreenshotRequest,
  FetchScreenshotResponse,
  NormalizedTree,
  PreviewArtifact,
  ResolvedNodeTarget,
  SourceSnapshot,
  WorkspaceRequestOptions,
} from "./contracts.js";
import type { RequestContext } from "../application/requestContext.js";

export type ConvertProgressStage =
  | "resolve_source"
  | "fetch_nodes"
  | "fetch_images"
  | "fetch_vectors"
  | "fetch_variables"
  | "materialize_assets"
  | "normalize"
  | "generate_code"
  | "write_artifact"
  | "generate_preview"
  | "build_diagnostics"
  | "complete";

export interface ConvertProgressUpdate {
  stage: ConvertProgressStage;
  progress: number;
  total: number;
  message: string;
}

export interface ConvertExecutionHooks {
  onProgress?(update: ConvertProgressUpdate): Promise<void> | void;
}

export interface SourceResolver {
  resolve(figmaUrl: string): ResolvedNodeTarget;
}

export interface SourceGateway {
  fetchNodes(target: ResolvedNodeTarget, workspace: WorkspaceRequestOptions): Promise<{
    fileKey: string;
    documents: Array<{ nodeId: string; document: Record<string, unknown> }>;
  }>;
  fetchImages(fileKey: string, workspace: WorkspaceRequestOptions): Promise<Record<string, string>>;
  fetchVectors(
    fileKey: string,
    ids: string[],
    workspace: WorkspaceRequestOptions,
  ): Promise<Record<string, string>>;
  fetchVariables(
    fileKey: string,
    workspace: WorkspaceRequestOptions,
  ): Promise<unknown | undefined>;
  fetchScreenshot(
    target: ResolvedNodeTarget,
    workspace: WorkspaceRequestOptions,
  ): Promise<{
    buffer: Buffer;
    contentType: string;
  }>;
  probeVariables(fileKey?: string, workspace?: WorkspaceRequestOptions): Promise<boolean>;
  probeAuthentication?(): Promise<boolean>;
}

export interface SnapshotAdapter {
  build(
    target: ResolvedNodeTarget,
    gatewayData: Awaited<ReturnType<SourceGateway["fetchNodes"]>>,
    images: Record<string, string>,
    vectors: Record<string, string>,
    variablesRaw?: unknown,
    requestCount?: number,
  ): SourceSnapshot;
}

export interface CapabilityProbe {
  getServiceSnapshot(): Promise<CapabilitySnapshot>;
  scopeForFramework(
    snapshot: CapabilitySnapshot,
    framework: ConversionOptions["framework"],
  ): CapabilitySnapshot;
  enrichForRequest(
    serviceSnapshot: CapabilitySnapshot,
    source?: SourceSnapshot,
  ): CapabilitySnapshot;
  enrichWithVariableProbe?(
    snapshot: CapabilitySnapshot,
    fileKey: string,
    workspace: WorkspaceRequestOptions,
  ): Promise<CapabilitySnapshot>;
}

export interface Normalizer {
  normalize(snapshot: SourceSnapshot, context: RequestContext): Promise<NormalizedTree>;
}

export interface CodeGenerator {
  generate(tree: NormalizedTree, context: RequestContext): Promise<ConversionArtifact>;
}

export interface PreviewGenerator {
  generate(
    tree: NormalizedTree,
    artifact: ConversionArtifact,
    context: RequestContext,
  ): Promise<PreviewArtifact | undefined>;
}

export interface CodeArtifactWriter {
  write(
    artifact: ConversionArtifact,
    context: RequestContext,
  ): Promise<ConversionArtifact>;
}

export interface AssetMaterializer {
  materialize(input: {
    target: ResolvedNodeTarget;
    gatewayData: Awaited<ReturnType<SourceGateway["fetchNodes"]>>;
    snapshot: SourceSnapshot;
    context: RequestContext;
  }): Promise<SourceSnapshot>;
}

export interface DiagnosticsBuilder {
  build(
    context: RequestContext,
    snapshot: SourceSnapshot | undefined,
    artifact: ConversionArtifact,
  ): DiagnosticsReport;
}

export interface ScreenshotArtifactWriter {
  readCached(
    target: ResolvedNodeTarget,
    workspace: WorkspaceRequestOptions,
  ): Promise<string | undefined>;
  write(input: {
    target: ResolvedNodeTarget;
    workspace: WorkspaceRequestOptions;
    buffer: Buffer;
    contentType: string;
  }): Promise<string>;
}

export interface ConvertUseCase {
  execute(request: ConvertRequest, hooks?: ConvertExecutionHooks): Promise<{
    artifact: ConversionArtifact;
    diagnostics?: DiagnosticsReport;
  }>;
}

export interface FetchScreenshotUseCase {
  execute(request: FetchScreenshotRequest): Promise<FetchScreenshotResponse>;
}
