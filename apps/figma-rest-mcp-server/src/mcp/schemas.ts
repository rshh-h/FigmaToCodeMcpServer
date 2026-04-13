import { z } from "zod";

const frameworkSchema = z.enum([
  "HTML",
  "Tailwind",
  "Flutter",
  "SwiftUI",
  "Compose",
]);
const generationModeSchema = z.enum([
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
]);

const sourceUrlDescription =
  "A Figma design/file URL for a single node. The URL must include the node-id query parameter, for example: https://www.figma.com/design/FILE_KEY/Example-File?node-id=1-1427&t=EXAMPLE-1";

function parseFigmaSourceUrl(urlString: string): { fileKey?: string; nodeId?: string } {
  try {
    const url = new URL(urlString);
    const parts = url.pathname.split("/").filter(Boolean);
    const designIndex = parts.findIndex((part) => part === "design" || part === "file");
    return {
      fileKey: designIndex === -1 ? undefined : parts[designIndex + 1],
      nodeId: url.searchParams.get("node-id") ?? undefined,
    };
  } catch {
    return {};
  }
}

export const convertRequestSchema = z
  .object({
    source: z.object({
      url: z.string().url().describe(sourceUrlDescription),
    }).superRefine((value, ctx) => {
      const parsed = parseFigmaSourceUrl(value.url);

      if (!parsed.fileKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source.url must include a valid Figma file key",
          path: ["url"],
        });
      }

      if (!parsed.nodeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source.url must include node-id",
          path: ["url"],
        });
      }
    }),
    workspaceRoot: z
      .string()
      .min(1)
      .describe(
        "Absolute or project-relative workspace root for this conversion. Generated code, intermediate files, and REST caches are stored under this directory.",
      ),
    useCache: z
      .boolean()
      .default(true)
      .describe(
        "Whether to reuse cached Figma REST data and previously materialized workspace intermediates. Defaults to true.",
      ),
    framework: frameworkSchema,
    generationMode: generationModeSchema.optional(),
    options: z
      .object({
        showLayerNames: z.boolean().optional(),
        useColorVariables: z.boolean().optional(),
        embedImages: z.boolean().optional(),
        embedVectors: z.boolean().optional(),
        roundTailwindValues: z.boolean().optional(),
        roundTailwindColors: z.boolean().optional(),
        customTailwindPrefix: z.string().optional(),
        useTailwind4: z.boolean().optional(),
        baseFontSize: z.number().min(1).max(96).optional(),
        thresholdPercent: z.number().min(0).max(1).optional(),
        baseFontFamily: z.string().optional(),
        fontFamilyCustomConfig: z.record(z.array(z.string())).optional(),
        downloadImagesToLocal: z
          .boolean()
          .default(true)
          .describe("Whether to download image resources into the workspace. Defaults to true."),
        downloadVectorsToLocal: z
          .boolean()
          .default(true)
          .describe("Whether to download SVG/vector resources into the workspace. Defaults to true."),
      })
      .default({}),
    returnPreview: z.boolean().default(false),
    includeDiagnostics: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.generationMode &&
      value.framework === "HTML" &&
      !["html", "jsx", "styled-components", "svelte"].includes(value.generationMode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "generationMode is not valid for HTML",
        path: ["generationMode"],
      });
    }
    if (
      value.generationMode &&
      value.framework === "Tailwind" &&
      !["html", "jsx", "twig"].includes(value.generationMode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "generationMode is not valid for Tailwind",
        path: ["generationMode"],
      });
    }
    if (
      value.generationMode &&
      value.framework === "Flutter" &&
      !["fullApp", "stateless", "snippet"].includes(value.generationMode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "generationMode is not valid for Flutter",
        path: ["generationMode"],
      });
    }
    if (
      value.generationMode &&
      value.framework === "SwiftUI" &&
      !["preview", "struct", "snippet"].includes(value.generationMode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "generationMode is not valid for SwiftUI",
        path: ["generationMode"],
      });
    }
    if (
      value.generationMode &&
      value.framework === "Compose" &&
      !["snippet", "composable", "screen"].includes(value.generationMode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "generationMode is not valid for Compose",
        path: ["generationMode"],
      });
    }
  });

export const convertResponseSchema = z.object({
  framework: frameworkSchema,
  code: z.string(),
  warnings: z.array(z.string()),
  preview: z
    .object({
      width: z.number(),
      height: z.number(),
      html: z.string(),
    })
    .optional(),
  diagnostics: z
    .object({
      adapter: z.literal("rest"),
      sourceFileKey: z.string().optional(),
      sourceNodeIds: z.array(z.string()).optional(),
      sourceNodeCount: z.number().optional(),
      decisions: z.array(
        z.object({
          feature: z.enum([
            "colorVariables",
            "textSegmentation",
            "preview",
            "images",
            "vectors",
            "diagnostics",
          ]),
          requested: z.boolean(),
          effective: z.boolean(),
          supportLevel: z.enum(["full", "partial", "none"]),
          stage: z.enum([
            "resolve_source",
            "probe_capabilities",
            "fetch_snapshot",
            "normalize",
            "generate_code",
            "generate_preview",
            "build_diagnostics",
          ]),
          reason: z.string(),
        }),
      ),
      timing: z.record(z.number()),
      traceId: z.string().optional(),
    })
    .optional(),
});

export const capabilitiesRequestSchema = z.object({
  framework: frameworkSchema.optional(),
});

export const capabilitiesResponseSchema = z.object({
  frameworks: z.array(
    z.object({
      name: frameworkSchema,
      supported: z.boolean(),
      generationModes: z.array(z.string()),
    }),
  ),
  features: z.object({
    colorVariables: z.enum(["full", "partial", "none"]),
    textSegmentation: z.enum(["full", "partial", "none"]),
    preview: z.enum(["full", "partial", "none"]),
    images: z.enum(["full", "partial", "none"]),
    vectors: z.enum(["full", "partial", "none"]),
    diagnostics: z.enum(["full", "partial", "none"]),
  }),
  limits: z.array(z.string()),
});

export type ConvertRequestInput = z.infer<typeof convertRequestSchema>;
export type CapabilitiesRequestInput = z.infer<typeof capabilitiesRequestSchema>;
