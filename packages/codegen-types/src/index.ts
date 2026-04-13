export type Framework = "HTML" | "Tailwind" | "Flutter" | "SwiftUI" | "Compose";

export interface HTMLSettings {
  showLayerNames: boolean;
  embedImages: boolean;
  embedVectors: boolean;
  useColorVariables: boolean;
  htmlGenerationMode: "html" | "jsx" | "styled-components" | "svelte";
}

export interface TailwindSettings extends HTMLSettings {
  tailwindGenerationMode: "html" | "jsx" | "twig";
  roundTailwindValues: boolean;
  roundTailwindColors: boolean;
  customTailwindPrefix?: string;
  baseFontSize: number;
  useTailwind4: boolean;
  thresholdPercent: number;
  baseFontFamily: string;
  fontFamilyCustomConfig: Record<string, string[]>;
}

export interface FlutterSettings {
  flutterGenerationMode: "fullApp" | "stateless" | "snippet";
}

export interface SwiftUISettings {
  swiftUIGenerationMode: "preview" | "struct" | "snippet";
}

export interface ComposeSettings {
  composeGenerationMode: "snippet" | "composable" | "screen";
}

export interface CodegenSettings
  extends TailwindSettings,
    FlutterSettings,
    SwiftUISettings,
    ComposeSettings {
  framework: Framework;
}

export interface ConversionPreview {
  width: number;
  height: number;
  html: string;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorSpec {
  source: string;
  rgb: RGB;
}

export interface SolidColorConversion {
  hex: string;
  colorName: string;
  exportValue: string;
  contrastWhite: number;
  contrastBlack: number;
  meta?: string;
}

export interface LinearGradientConversion {
  cssPreview: string;
  exportValue: string;
}

export type Warning = string;

export interface VariableBindingLike {
  field: string;
  variableId: string;
  variableName?: string;
  variableModeId?: string;
  variableModeName?: string;
  variableValue?: unknown;
  resolvedType?: string;
  resolutionStatus: "resolved" | "id-only" | "unavailable";
}

export interface ImageHintLike {
  imageRef: string;
  path: string;
}

export interface VectorHintLike {
  nodeId: string;
  preferredFormat: "svg";
  required: boolean;
}

export interface TextSegmentLike {
  text: string;
  start: number;
  end: number;
  style: Record<string, unknown>;
}

export interface CompatibilityNodeLike {
  id: string;
  name: string;
  uniqueName: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  text?: string;
  textSegments: TextSegmentLike[];
  style: Record<string, unknown>;
  layout: Record<string, unknown>;
  imageHints: ImageHintLike[];
  vectorHints: VectorHintLike[];
  variableBindings: VariableBindingLike[];
  children: CompatibilityNodeLike[];
}

export interface CompatibilityTreeLike {
  fileKey: string;
  rootNodeIds: string[];
  roots: CompatibilityNodeLike[];
}

export function createDefaultCodegenSettings(
  framework: Framework,
): CodegenSettings {
  return {
    framework,
    showLayerNames: false,
    embedImages: true,
    embedVectors: true,
    useColorVariables: true,
    htmlGenerationMode: "html",
    tailwindGenerationMode: "html",
    roundTailwindValues: false,
    roundTailwindColors: false,
    customTailwindPrefix: undefined,
    baseFontSize: 16,
    useTailwind4: true,
    thresholdPercent: 0.5,
    baseFontFamily: "Inter",
    fontFamilyCustomConfig: {},
    flutterGenerationMode: "snippet",
    swiftUIGenerationMode: "snippet",
    composeGenerationMode: "snippet",
  };
}
