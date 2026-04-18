export type Framework = "HTML" | "Tailwind" | "Flutter" | "SwiftUI" | "Compose";

export type HtmlGenerationMode =
  | "html"
  | "jsx"
  | "styled-components"
  | "svelte";
export type TailwindGenerationMode = "html" | "jsx" | "twig";
export type FlutterGenerationMode = "fullApp" | "stateless" | "snippet";
export type SwiftUIGenerationMode = "preview" | "struct" | "snippet";
export type ComposeGenerationMode = "snippet" | "composable" | "screen";
export type GenerationMode =
  | HtmlGenerationMode
  | TailwindGenerationMode
  | FlutterGenerationMode
  | SwiftUIGenerationMode
  | ComposeGenerationMode;

export type SupportLevel = "full" | "partial" | "none";
export type DiagnosticsFeature =
  | "colorVariables"
  | "textSegmentation"
  | "preview"
  | "images"
  | "vectors"
  | "diagnostics";

export type StageName =
  | "resolve_source"
  | "probe_capabilities"
  | "fetch_snapshot"
  | "normalize"
  | "generate_code"
  | "generate_preview"
  | "build_diagnostics";

export type ErrorCategory =
  | "ToolValidationError"
  | "AuthenticationError"
  | "AuthorizationError"
  | "SourceNotFoundError"
  | "UnsupportedFeatureError"
  | "ConversionFailedError"
  | "InternalServiceError";

export interface FigmaSourceRef {
  url: string;
}

export interface ResolvedNodeTarget {
  fileKey: string;
  nodeIds: string[];
  raw: FigmaSourceRef;
  sourceKind: "url";
}

export interface FigmaNodeLike {
  id: string;
  name?: string;
  type: string;
  visible?: boolean;
  rotation?: number;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  size?: {
    x: number;
    y: number;
  };
  relativeTransform?: number[][];
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  boundVariables?: Record<string, unknown>;
  fills?: Array<Record<string, unknown>>;
  children?: FigmaNodeLike[];
  characters?: string;
  style?: Record<string, unknown>;
  styleOverrideTable?: Record<string, Record<string, unknown>>;
  characterStyleOverrides?: number[];
  [key: string]: unknown;
}

export interface VectorCandidate {
  id: string;
  name?: string;
  depth: number;
  reason?: string;
}

export interface SourceSnapshot {
  fileKey: string;
  targetNodeIds: string[];
  sourceNodes: Array<{
    nodeId: string;
    document: FigmaNodeLike;
  }>;
  imageRefs: string[];
  imageUrls: Record<string, string>;
  localImagePaths?: Record<string, string>;
  vectorCandidates: VectorCandidate[];
  vectorUrls: Record<string, string>;
  localVectorPaths?: Record<string, string>;
  localVectorRootMappings?: Array<{
    rootNodeId: string;
    childNodeIds: string[];
    path: string;
  }>;
  localAssetManifestPaths?: {
    imageRefsPath?: string;
    imagesResponsePath?: string;
    imageManifestPath?: string;
    variableRefsPath?: string;
    variablesResponsePath?: string;
    variableManifestPath?: string;
    vectorCandidatesPath?: string;
    vectorSvgUrlsPath?: string;
    vectorManifestPath?: string;
  };
  variablesRaw?: unknown;
  metadata: {
    fetchedAt: string;
    requestCount: number;
  };
}

export interface VariableBinding {
  field: string;
  variableId: string;
  variableName?: string;
  variableModeId?: string;
  variableModeName?: string;
  variableValue?: unknown;
  resolvedType?: string;
  resolutionStatus: "resolved" | "id-only" | "unavailable";
}

export interface ImageHint {
  imageRef: string;
  path: string;
}

export interface VectorHint {
  nodeId: string;
  preferredFormat: "svg";
  required: boolean;
}

export interface AssetSupportRequirements {
  images: boolean;
  vectors: boolean;
  variables: boolean;
}

export interface NormalizedTextSegment {
  text: string;
  start: number;
  end: number;
  style: Record<string, unknown>;
}

export interface NormalizedNode {
  id: string;
  name: string;
  uniqueName: string;
  type: string;
  visible: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  cumulativeRotation: number;
  relativePositioning: "relative" | "absolute";
  layout: Record<string, unknown>;
  style: Record<string, unknown>;
  text?: string;
  textSegments: NormalizedTextSegment[];
  variableBindings: VariableBinding[];
  imageHints: ImageHint[];
  vectorHints: VectorHint[];
  assetSupportRequirements: AssetSupportRequirements;
  children: NormalizedNode[];
  rawNodeId: string;
}

export interface NormalizedTree {
  fileKey: string;
  rootNodeIds: string[];
  roots: NormalizedNode[];
}

export interface FrameworkCapability {
  name: Framework;
  supported: boolean;
  generationModes: string[];
}

export interface CapabilityFeatures {
  colorVariables: SupportLevel;
  textSegmentation: SupportLevel;
  preview: SupportLevel;
  images: SupportLevel;
  vectors: SupportLevel;
  diagnostics: SupportLevel;
}

export interface CapabilitySnapshot {
  [key: string]: unknown;
  scope: "service" | "request";
  frameworks: FrameworkCapability[];
  features: CapabilityFeatures;
  limits: string[];
}

export interface FeatureDecision {
  feature: DiagnosticsFeature;
  requested: boolean;
  effective: boolean;
  supportLevel: SupportLevel;
  stage: StageName;
  reason: string;
}

export interface DegradationRecord {
  feature: DiagnosticsFeature;
  stage: StageName;
  reason: string;
  affectsCorrectness: boolean;
  affectsFidelity: boolean;
}

export interface DiagnosticsReport {
  [key: string]: unknown;
  adapter: "rest";
  sourceFileKey?: string;
  sourceNodeIds?: string[];
  sourceNodeCount?: number;
  decisions: FeatureDecision[];
  timing: Record<StageName, number>;
  traceId?: string;
}

export interface WorkspaceRequestOptions {
  workspaceRoot: string;
  useCache: boolean;
}

export interface PreviewArtifact {
  width: number;
  height: number;
  html: string;
}

export interface ConversionArtifact {
  framework: Framework;
  code: string;
  warnings: string[];
  preview?: PreviewArtifact;
}

export interface StandardErrorShape {
  [key: string]: unknown;
  category: ErrorCategory;
  code: string;
  stage: StageName;
  message: string;
  suggestion: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ConversionOptions {
  framework: Framework;
  htmlGenerationMode?: HtmlGenerationMode;
  tailwindGenerationMode?: TailwindGenerationMode;
  flutterGenerationMode?: FlutterGenerationMode;
  swiftUIGenerationMode?: SwiftUIGenerationMode;
  composeGenerationMode?: ComposeGenerationMode;
  showLayerNames?: boolean;
  useColorVariables?: boolean;
  embedImages?: boolean;
  embedVectors?: boolean;
  roundTailwindValues?: boolean;
  roundTailwindColors?: boolean;
  customTailwindPrefix?: string;
  useTailwind4?: boolean;
  baseFontSize?: number;
  thresholdPercent?: number;
  baseFontFamily?: string;
  fontFamilyCustomConfig?: Record<string, string[]>;
  downloadImagesToLocal?: boolean;
  downloadVectorsToLocal?: boolean;
  returnPreview?: boolean;
  includeDiagnostics?: boolean;
}

export interface ConvertRequest {
  figmaUrl: string;
  workspaceRoot: string;
  useCache?: boolean;
  framework: Framework;
  generationMode?: GenerationMode;
}

export interface ConvertResponse {
  [key: string]: unknown;
  framework: Framework;
  code: string;
  warnings: string[];
  preview?: PreviewArtifact;
  diagnostics?: DiagnosticsReport;
}

export interface CapabilitiesRequest {
  framework?: Framework;
}

export interface CapabilitiesResponse {
  [key: string]: unknown;
  frameworks: FrameworkCapability[];
  features: CapabilityFeatures;
  limits: string[];
}
