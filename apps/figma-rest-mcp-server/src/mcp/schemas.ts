import { z } from "zod";
import {
  allGenerationModes,
  generationModesByFramework,
  supportedFrameworks,
} from "./convertToolMetadata.js";

const frameworkSchema = z.enum(supportedFrameworks);
const generationModeSchema = z.enum(allGenerationModes);

const figmaUrlDescription =
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
    figmaUrl: z.string().url().describe(figmaUrlDescription),
    workspaceRoot: z
      .string()
      .min(1)
      .describe(
        "Absolute or project-relative workspace root for this conversion. Generated code, intermediate files, and REST caches are stored under this directory.",
      ),
    useCache: z
      .boolean()
      .default(false)
      .describe(
        "Whether to reuse cached Figma REST data and previously materialized workspace intermediates. Defaults to false.",
      ),
    framework: frameworkSchema,
    generationMode: generationModeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = parseFigmaSourceUrl(value.figmaUrl);

    if (!parsed.fileKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "figmaUrl must include a valid Figma file key",
        path: ["figmaUrl"],
      });
    }

    if (!parsed.nodeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "figmaUrl must include node-id",
        path: ["figmaUrl"],
      });
    }
  })
  .superRefine((value, ctx) => {
    if (
      value.generationMode &&
      value.framework === "HTML" &&
      !(generationModesByFramework.HTML as readonly string[]).includes(value.generationMode)
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
      !(generationModesByFramework.Tailwind as readonly string[]).includes(value.generationMode)
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
      !(generationModesByFramework.Flutter as readonly string[]).includes(value.generationMode)
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
      !(generationModesByFramework.SwiftUI as readonly string[]).includes(value.generationMode)
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
      !(generationModesByFramework.Compose as readonly string[]).includes(value.generationMode)
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

export const convertHelpRequestSchema = z.object({});

export const convertHelpResponseSchema = z.object({
  example: z.object({
    figmaUrl: z.string().url(),
    workspaceRoot: z.string(),
    useCache: z.boolean(),
    framework: frameworkSchema,
    generationMode: generationModeSchema.optional(),
  }),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["string", "boolean", "enum"]),
      required: z.boolean(),
      default: z.union([z.string(), z.boolean()]).optional(),
      enum: z.array(z.string()).optional(),
      description: z.string(),
    }),
  ),
  generationModesByFramework: z.object({
    HTML: z.array(z.string()),
    Tailwind: z.array(z.string()),
    Flutter: z.array(z.string()),
    SwiftUI: z.array(z.string()),
    Compose: z.array(z.string()),
  }),
  notes: z.array(z.string()),
});

export type ConvertRequestInput = z.infer<typeof convertRequestSchema>;
export type CapabilitiesRequestInput = z.infer<typeof capabilitiesRequestSchema>;
