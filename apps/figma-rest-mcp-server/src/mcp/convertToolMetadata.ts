export const supportedFrameworks = [
  "HTML",
  "Tailwind",
  "Flutter",
  "SwiftUI",
  "Compose",
] as const;

export const generationModesByFramework = {
  HTML: ["html", "jsx", "styled-components", "svelte"],
  Tailwind: ["html", "jsx", "twig"],
  Flutter: ["fullApp", "stateless", "snippet"],
  SwiftUI: ["preview", "struct", "snippet"],
  Compose: ["snippet", "composable", "screen"],
} as const;

export const allGenerationModes = [
  "html",
  "jsx",
  "styled-components",
  "svelte",
  "twig",
  "fullApp",
  "stateless",
  "snippet",
  "preview",
  "struct",
  "composable",
  "screen",
] as const;

export const convertHelpExample = {
  figmaUrl: "https://www.figma.com/design/FILE_KEY/Example-File?node-id=1-1427&t=EXAMPLE-1",
  workspaceRoot: "/absolute/path/to/your/project",
  useCache: false,
  framework: "Tailwind",
  generationMode: "jsx",
} as const;

export const convertHelpFields = [
  {
    name: "figmaUrl",
    type: "string",
    required: true,
    description:
      "A Figma design/file URL for a single node. The URL must include node-id.",
  },
  {
    name: "workspaceRoot",
    type: "string",
    required: true,
    description:
      "Absolute or project-relative workspace root used for generated files, cache, and intermediates.",
  },
  {
    name: "useCache",
    type: "boolean",
    required: false,
    default: false,
    description:
      "Whether to reuse cached Figma REST data and previously materialized workspace artifacts.",
  },
  {
    name: "framework",
    type: "enum",
    required: true,
    enum: [...supportedFrameworks],
    description: "Target code framework.",
  },
  {
    name: "generationMode",
    type: "enum",
    required: false,
    description: "Optional generation mode. Valid values depend on framework.",
  },
] as const;

export const convertHelpNotes = [
  "Call this tool first when you need a valid figma_to_code_convert request template.",
  "figmaUrl must include both a valid Figma file key and node-id.",
  "Diagnostics are controlled by the INCLUDE_DIAGNOSTICS server environment variable.",
  "figma_to_code_convert returns code as a generated file path relative to workspaceRoot.",
  "preview is defined in the schema but is currently disabled by the implementation.",
] as const;

export function createConvertHelpResponse() {
  return {
    example: convertHelpExample,
    fields: convertHelpFields,
    generationModesByFramework,
    notes: convertHelpNotes,
  };
}
