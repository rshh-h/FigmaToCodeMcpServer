import type { HttpClient } from "../infrastructure/httpClient.js";
import type { Logger } from "../infrastructure/logger.js";

const DEFAULT_VECTOR_EXPORT_BATCH_SIZE = 8;

function chunkIds(ids: string[], batchSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += batchSize) {
    chunks.push(ids.slice(index, index + batchSize));
  }
  return chunks;
}

export async function fetchSvgSignedUrls(input: {
  fileKey: string;
  ids: string[];
  token: string;
  httpClient: HttpClient;
  batchSize?: number;
  logger?: Logger;
  traceId?: string;
  flow?: string;
}): Promise<Record<string, string>> {
  const batchSize = input.batchSize ?? DEFAULT_VECTOR_EXPORT_BATCH_SIZE;
  const signedUrls: Record<string, string> = {};
  const batches = chunkIds(input.ids, batchSize);

  input.logger?.info("SVG export URL fetch started", {
    flow: input.flow ?? "vectors",
    traceId: input.traceId,
    fileKey: input.fileKey,
    totalIds: input.ids.length,
    batchSize,
    batchCount: batches.length,
  });

  for (const [batchIndex, batch] of batches.entries()) {
    if (batch.length === 0) {
      continue;
    }

    const startedAt = Date.now();

    try {
      const body = await input.httpClient.getJson<{
        images?: Record<string, string>;
      }>({
        path: `/v1/images/${input.fileKey}`,
        headers: {
          "X-Figma-Token": input.token,
        },
        query: {
          ids: batch.join(","),
          format: "svg",
        },
      });

      const batchUrls = body.images ?? {};
      Object.assign(signedUrls, batchUrls);
    } catch (error) {
      input.logger?.warn("SVG export URL fetch batch failed", {
        flow: input.flow ?? "vectors",
        traceId: input.traceId,
        fileKey: input.fileKey,
        batchIndex: batchIndex + 1,
        batchCount: batches.length,
        requestedIds: batch.length,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        errorCode:
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code)
            : undefined,
        errorCategory:
          error && typeof error === "object" && "category" in error
            ? String((error as { category?: unknown }).category)
            : undefined,
      });
      throw error;
    }
  }

  input.logger?.info("SVG export URL fetch completed", {
    flow: input.flow ?? "vectors",
    traceId: input.traceId,
    fileKey: input.fileKey,
    totalIds: input.ids.length,
    resolvedUrls: Object.keys(signedUrls).length,
  });

  return signedUrls;
}
