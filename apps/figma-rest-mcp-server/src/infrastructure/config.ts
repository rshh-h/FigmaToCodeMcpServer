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

export const configSchema = z.object({
  FIGMA_ACCESS_TOKEN: z.string().min(1).optional(),
  FIGMA_API_BASE_URL: z.string().url().default("https://api.figma.com"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  HTTP_RETRY_MAX: z.coerce.number().int().min(0).max(5).default(2),
  HTTP_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(6),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(300_000),
  IMAGE_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  VECTOR_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  VARIABLE_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  AUTH_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  ENABLE_VARIABLES: booleanFromEnv.default(true),
  ENABLE_IMAGE_EMBED: booleanFromEnv.default(true),
  ENABLE_VECTOR_EMBED: booleanFromEnv.default(true),
  ENABLE_PREVIEW: booleanFromEnv.default(true),
  ENABLE_METRICS_LOGGING: booleanFromEnv.default(false),
  LOCAL_ASSET_OUTPUT_DIR: z.string().default(".figma-to-code/cache/assets"),
  GENERATED_CODE_OUTPUT_DIR: z.string().default("tmp/generated"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
