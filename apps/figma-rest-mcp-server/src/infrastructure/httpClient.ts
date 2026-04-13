import { ServiceError } from "../core/errors.js";
import type { Logger } from "./logger.js";
import type { Metrics } from "./metrics.js";
import type { RateLimitGate } from "./rateLimitGate.js";

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  retryMax: number;
  logger: Logger;
  metrics: Metrics;
  gate?: RateLimitGate;
}

export interface HttpRequestOptions {
  path?: string;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface BinaryResponse {
  buffer: Buffer;
  contentType: string;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string>): URL {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  async getJson<T>(request: HttpRequestOptions): Promise<T> {
    const text = await this.getText(request);
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async getBinary(request: HttpRequestOptions): Promise<BinaryResponse> {
    const response = await this.request(request);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };
  }

  async getText(request: HttpRequestOptions): Promise<string> {
    const response = await this.request(request);
    return await response.text();
  }

  private async request(request: HttpRequestOptions): Promise<Response> {
    const url = request.url
      ? new URL(request.url)
      : buildUrl(this.options.baseUrl, request.path ?? "/", request.query);
    const requestPath = request.path ?? url.pathname;
    const deadline = Date.now() + this.options.timeoutMs;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.options.retryMax; attempt += 1) {
      const remainingBudget = deadline - Date.now();
      if (remainingBudget <= 0) {
        lastError = new ServiceError({
          category: "ConversionFailedError",
          code: "figma_http_timeout",
          stage: "fetch_snapshot",
          message: "Figma API request exceeded the total timeout budget.",
          suggestion: "Retry later or reduce the number of retries/slow endpoints.",
          retryable: true,
          details: {
            path: requestPath,
          },
        });
        break;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), remainingBudget);
      const startedAt = Date.now();

      try {
        const response = await this.fetchWithGate(url, {
          method: request.method ?? "GET",
          headers: request.headers,
          signal: controller.signal,
        });

        const duration = Date.now() - startedAt;
        this.options.metrics.timing("figma_http_request_ms", duration, {
          path: requestPath,
          method: request.method ?? "GET",
          status: String(response.status),
        });

        const clone = response.clone();
        const text = await clone.text();
        const body = text ? safeJsonParse(text) : undefined;

        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < this.options.retryMax) {
            this.options.metrics.increment("figma_http_retry_total", 1, {
              path: requestPath,
              status: String(response.status),
              attempt: String(attempt + 1),
            });
            await sleep(Math.min(backoffMs(attempt), Math.max(deadline - Date.now(), 0)));
            continue;
          }

          this.options.metrics.increment("figma_http_error_total", 1, {
            path: requestPath,
            status: String(response.status),
          });
          throw new ServiceError({
            category:
              response.status === 401
                ? "AuthenticationError"
                : response.status === 403
                  ? "AuthorizationError"
                  : response.status === 404
                    ? "SourceNotFoundError"
                    : "ConversionFailedError",
            code: `figma_http_${response.status}`,
            stage: "fetch_snapshot",
            message: `Figma API request failed with status ${response.status}.`,
            suggestion: suggestionForStatus(response.status),
            retryable: response.status === 429 || response.status >= 500,
            details: {
              path: requestPath,
              body,
            },
          });
        }

        return response;
      } catch (error) {
        lastError =
          error instanceof DOMException && error.name === "AbortError"
            ? new ServiceError({
                category: "ConversionFailedError",
                code: "figma_http_timeout",
                stage: "fetch_snapshot",
                message: "Figma API request exceeded the total timeout budget.",
                suggestion: "Retry later or reduce the number of retries/slow endpoints.",
                retryable: true,
                details: {
                  path: requestPath,
                },
              })
            : error;
        if (
          error instanceof ServiceError &&
          !error.retryable
        ) {
          throw error;
        }

        if (attempt >= this.options.retryMax) {
          break;
        }

        this.options.metrics.increment("figma_http_retry_total", 1, {
          path: requestPath,
          status: "network_error",
          attempt: String(attempt + 1),
        });
        await sleep(Math.min(backoffMs(attempt), Math.max(deadline - Date.now(), 0)));
      } finally {
        clearTimeout(timeout);
      }
    }

    this.options.logger.error("HTTP request failed", {
      path: requestPath,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });

    if (lastError instanceof ServiceError) {
      if (lastError.code === "figma_http_timeout") {
        this.options.metrics.increment("figma_http_timeout_total", 1, {
          path: requestPath,
        });
      }
      throw lastError;
    }

    this.options.metrics.increment("figma_http_error_total", 1, {
      path: requestPath,
      status: "network_error",
    });
    throw new ServiceError({
      category: "ConversionFailedError",
      code: "figma_http_request_failed",
      stage: "fetch_snapshot",
      message: "Figma API request failed after retries.",
      suggestion: "Retry later or inspect the server logs for the failing endpoint.",
      retryable: true,
    });
  }

  private async fetchWithGate(
    url: URL,
    init: RequestInit,
  ): Promise<Response> {
    if (!this.options.gate) {
      return await fetch(url, init);
    }

    return await this.options.gate.withPermit(async () => await fetch(url, init));
  }
}

function suggestionForStatus(status: number): string {
  if (status === 401) {
    return "Set a valid FIGMA_ACCESS_TOKEN and confirm it has not expired or been revoked.";
  }
  if (status === 403) {
    return "Confirm the token has access to the Figma file and the file is shared with the token owner.";
  }
  if (status === 404) {
    return "Check the file key and node id, and confirm the node still exists in the Figma file.";
  }
  if (status === 429) {
    return "Retry after a short delay or reduce concurrent requests to stay within Figma API rate limits.";
  }
  if (status >= 500) {
    return "Retry later; Figma returned a server-side error for this endpoint.";
  }
  return "Check the file key, node id, token permissions, or try again later.";
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function backoffMs(attempt: number): number {
  return 200 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
