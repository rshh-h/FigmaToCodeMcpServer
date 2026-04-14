import { describe, expect, it, vi } from "vitest";
import { readConfig } from "../../src/infrastructure/config.js";
import { HttpClient } from "../../src/infrastructure/httpClient.js";
import { stderrLogger } from "../../src/infrastructure/logger.js";
import { InMemoryMetrics, noopMetrics } from "../../src/infrastructure/metrics.js";
import {
  MemoryCache,
  rememberInRequestCache,
  withRequestCache,
} from "../../src/infrastructure/cache.js";
import { RateLimitGate } from "../../src/infrastructure/rateLimitGate.js";

describe("infrastructure", () => {
  it("reads defaults from config", () => {
    const config = readConfig({});
    expect(config.FIGMA_API_BASE_URL).toBe("https://api.figma.com");
    expect(config.HTTP_RETRY_MAX).toBe(2);
    expect(config.HTTP_MAX_CONCURRENCY).toBe(6);
    expect(config.CACHE_MAX_ENTRIES).toBe(500);
    expect(config.ENABLE_METRICS_LOGGING).toBe(false);
    expect(config.SHOW_LAYER_NAMES).toBe(false);
    expect(config.USE_TAILWIND4).toBe(false);
    expect(config.DOWNLOAD_IMAGES_TO_LOCAL).toBe(true);
    expect(config.DOWNLOAD_VECTORS_TO_LOCAL).toBe(true);
  });

  it("retries retryable http failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ err: "rate limited" }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient({
      baseUrl: "https://api.figma.com",
      timeoutMs: 1000,
      retryMax: 1,
      logger: stderrLogger,
      metrics: noopMetrics,
    });

    const response = await client.getJson<{ ok: boolean }>({
      path: "/v1/files/demo/images",
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records retry metrics and actionable http suggestions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ err: "rate limited" }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ err: "missing" }), { status: 404 }),
      );
    const metrics = new InMemoryMetrics();

    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient({
      baseUrl: "https://api.figma.com",
      timeoutMs: 1000,
      retryMax: 1,
      logger: stderrLogger,
      metrics,
    });

    await expect(
      client.getJson({
        path: "/v1/files/demo/nodes",
      }),
    ).rejects.toMatchObject({
      code: "figma_http_404",
      suggestion: expect.stringContaining("file key and node id"),
    });

    expect(metrics.increments).toContainEqual({
      name: "figma_http_retry_total",
      value: 1,
      tags: {
        path: "/v1/files/demo/nodes",
        status: "429",
        attempt: "1",
      },
    });
    expect(metrics.increments).toContainEqual({
      name: "figma_http_error_total",
      value: 1,
      tags: {
        path: "/v1/files/demo/nodes",
        status: "404",
      },
    });
  });

  it("deduplicates work inside a request cache scope", async () => {
    const factory = vi.fn(async () => ({ ok: true }));

    const first = await withRequestCache(async () => {
      const firstValue = await Promise.all([
        rememberInRequestCache("demo", factory),
        rememberInRequestCache("demo", factory),
      ]);
      return firstValue;
    });

    expect(first).toHaveLength(2);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("evicts the oldest process cache entry when max entries is reached", () => {
    const cache = new MemoryCache<number>(60_000, 2);

    cache.set("first", 1);
    cache.set("second", 2);
    cache.set("third", 3);

    expect(cache.get("first")).toBeUndefined();
    expect(cache.get("second")).toBe(2);
    expect(cache.get("third")).toBe(3);
  });

  it("writes logs to stderr only", () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    stderrLogger.info("hello", { traceId: "trace-1" });

    expect(stderrWrite).toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();

    stderrWrite.mockRestore();
    stdoutWrite.mockRestore();
  });

  it("limits concurrent fetches through the rate gate", async () => {
    const gate = new RateLimitGate(1);
    const events: string[] = [];

    const first = gate.withPermit(async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push("first:end");
    });

    const second = gate.withPermit(async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.all([first, second]);

    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });
});
