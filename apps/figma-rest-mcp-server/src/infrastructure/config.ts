import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return value;
}, z.boolean());

const fontFamilyConfigFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.record(z.array(z.string())));

export const configSchema = z.object({
  FIGMA_ACCESS_TOKEN: z.string().min(1).optional(),
  FIGMA_API_BASE_URL: z.string().url().default("https://api.figma.com"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  HTTP_RETRY_MAX: z.coerce.number().int().min(0).max(5).default(2),
  HTTP_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(6),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(300_000),
  IMAGE_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  VECTOR_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  VARIABLE_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  AUTH_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  ENABLE_VARIABLES: booleanFromEnv.default(false),
  INCLUDE_DIAGNOSTICS: booleanFromEnv.default(false),
  ENABLE_IMAGE_EMBED: booleanFromEnv.default(true),
  ENABLE_VECTOR_EMBED: booleanFromEnv.default(true),
  ENABLE_METRICS_LOGGING: booleanFromEnv.default(false),
  SHOW_LAYER_NAMES: booleanFromEnv.default(false),
  ROUND_TAILWIND_VALUES: booleanFromEnv.default(true),
  ROUND_TAILWIND_COLORS: booleanFromEnv.default(true),
  USE_TAILWIND4: booleanFromEnv.default(false),
  CUSTOM_TAILWIND_PREFIX: z.string().default(""),
  BASE_FONT_SIZE: z.coerce.number().min(1).max(96).default(16),
  THRESHOLD_PERCENT: z.coerce.number().min(0).max(100).default(15),
  BASE_FONT_FAMILY: z.string().default(""),
  FONT_FAMILY_CUSTOM_CONFIG: fontFamilyConfigFromEnv.default({}),
  DOWNLOAD_IMAGES_TO_LOCAL: booleanFromEnv.default(true),
  DOWNLOAD_VECTORS_TO_LOCAL: booleanFromEnv.default(true),
});

export type AppConfig = z.infer<typeof configSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
