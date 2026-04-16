import { describe, expect, it, vi } from "vitest";
import { FigmaRestGateway } from "../../src/adapters/figmaRestGateway.js";
import { withRequestCache } from "../../src/infrastructure/cache.js";
import { readConfig } from "../../src/infrastructure/config.js";
import { stderrLogger } from "../../src/infrastructure/logger.js";
import { noopMetrics } from "../../src/infrastructure/metrics.js";
import { ServiceError } from "../../src/core/errors.js";
import { TokenProvider } from "../../src/infrastructure/tokenProvider.js";

function createWorkspace() {
  return {
    workspaceRoot: `/tmp/figma-rest-gateway-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    useCache: true,
  } as const;
}

describe("FigmaRestGateway", () => {
  it("reuses process cache for images across requests", async () => {
    const workspace = createWorkspace();
    const getJson = vi.fn().mockResolvedValue({
      meta: { images: { hero: "https://signed.example.com/hero.png" } },
    });
    const gateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token", ENABLE_VARIABLES: "true" }),
      { getJson } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token", ENABLE_VARIABLES: "true" })),
      stderrLogger,
      noopMetrics,
    );

    await withRequestCache(async () => {
      await gateway.fetchImages("FILE", workspace);
    });
    await withRequestCache(async () => {
      await gateway.fetchImages("FILE", workspace);
    });

    expect(getJson).toHaveBeenCalledTimes(1);
  });

  it("reuses request cache for variables and variable probe", async () => {
    const workspace = createWorkspace();
    const getJson = vi.fn().mockResolvedValue({
      meta: {
        variables: {
          "VariableID:demo/1": {
            id: "VariableID:demo/1",
            name: "color.brand.primary",
          },
        },
      },
    });
    const gateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token", ENABLE_VARIABLES: "true" }),
      { getJson } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token", ENABLE_VARIABLES: "true" })),
      stderrLogger,
      noopMetrics,
    );

    await withRequestCache(async () => {
      const variables = await gateway.fetchVariables("FILE", workspace);
      const supported = await gateway.probeVariables("FILE", workspace);
      expect(variables).toBeDefined();
      expect(supported).toBe(true);
    });

    expect(getJson).toHaveBeenCalledTimes(1);
  });

  it("downloads svg markup from signed vector URLs", async () => {
    const workspace = createWorkspace();
    const getJson = vi.fn().mockResolvedValue({
      images: {
        "1:2": "https://signed.example.com/vector.svg",
      },
    });
    const getText = vi.fn().mockResolvedValue("<svg data-node=\"1:2\"></svg>");
    const gateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      { getJson, getText } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    const vectors = await withRequestCache(
      async () => await gateway.fetchVectors("FILE", ["1:2"], workspace),
    );

    expect(vectors["1:2"]).toContain("<svg");
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(getText).toHaveBeenCalledWith({
      url: "https://signed.example.com/vector.svg",
    });
  });

  it("drops non-SVG payloads returned by signed vector URLs", async () => {
    const workspace = createWorkspace();
    const getJson = vi.fn().mockResolvedValue({
      images: {
        "1:2": "https://signed.example.com/not-actually-svg",
      },
    });
    const getText = vi.fn().mockResolvedValue(
      "<!doctype html><html><head><title>Figma Developer Docs</title></head><body></body></html>",
    );
    const gateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      { getJson, getText } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    const vectors = await withRequestCache(
      async () => await gateway.fetchVectors("FILE", ["1:2"], workspace),
    );

    expect(vectors).toEqual({});
  });

  it("sanitizes polluted vector disk cache entries before reuse", async () => {
    const workspace = createWorkspace();
    const firstGateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      {
        getJson: vi.fn().mockResolvedValue({
          images: {
            "1:2": "https://signed.example.com/not-actually-svg",
          },
        }),
        getText: vi.fn().mockResolvedValue(
          "<!doctype html><html><head><title>Figma Developer Docs</title></head><body></body></html>",
        ),
      } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    await withRequestCache(async () => {
      await firstGateway.fetchVectors("FILE", ["1:2"], workspace);
    });

    const secondGateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      {
        getJson: vi.fn(),
        getText: vi.fn(),
      } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    const vectors = await withRequestCache(async () => {
      return await secondGateway.fetchVectors("FILE", ["1:2"], workspace);
    });

    expect(vectors).toEqual({});
  });

  it("reuses workspace disk cache across gateway instances", async () => {
    const workspace = createWorkspace();
    const firstGateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      {
        getJson: vi.fn().mockResolvedValue({
          meta: { images: { hero: "https://signed.example.com/hero.png" } },
        }),
      } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    await withRequestCache(async () => {
      await firstGateway.fetchImages("FILE", workspace);
    });

    const secondGetJson = vi.fn().mockResolvedValue({
      meta: { images: { hero: "https://signed.example.com/hero-2.png" } },
    });
    const secondGateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      { getJson: secondGetJson } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    const images = await withRequestCache(async () => {
      return await secondGateway.fetchImages("FILE", workspace);
    });

    expect(images.hero).toBe("https://signed.example.com/hero.png");
    expect(secondGetJson).not.toHaveBeenCalled();
  });

  it("treats authentication errors as an invalid startup token", async () => {
    const getJson = vi.fn().mockRejectedValue(
      new ServiceError({
        category: "AuthenticationError",
        code: "figma_http_401",
        stage: "fetch_snapshot",
        message: "unauthorized",
        suggestion: "fix token",
        retryable: false,
      }),
    );
    const gateway = new FigmaRestGateway(
      readConfig({ FIGMA_ACCESS_TOKEN: "token" }),
      { getJson } as any,
      new TokenProvider(readConfig({ FIGMA_ACCESS_TOKEN: "token" })),
      stderrLogger,
      noopMetrics,
    );

    const authenticated = await withRequestCache(async () => await gateway.probeAuthentication());
    expect(authenticated).toBe(false);
  });
});
