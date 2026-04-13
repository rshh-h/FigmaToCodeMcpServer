import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestContext } from "../../src/application/requestContext.js";

describe("PreviewAdapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("codegen-kernel");
  });

  it("treats preview generation failures as non-fatal", async () => {
    vi.doMock("codegen-kernel", () => ({
      generateHtmlPreviewArtifact: vi.fn(async () => {
        throw new Error("preview failed");
      }),
    }));

    const { PreviewAdapter } = await import("../../src/adapters/previewAdapter.js");
    const adapter = new PreviewAdapter();
    const context = createRequestContext({
      traceId: "trace-preview-failure",
      options: {
        framework: "HTML",
      },
      serviceCapabilitySnapshot: {
        scope: "service",
        frameworks: [],
        features: {
          colorVariables: "partial",
          textSegmentation: "partial",
          preview: "full",
          images: "partial",
          vectors: "partial",
          diagnostics: "full",
        },
        limits: [],
      },
    });

    const preview = await adapter.generate(
      {
        fileKey: "FILE",
        rootNodeIds: ["root"],
        roots: [],
      },
      {
        framework: "HTML",
        code: "<div />",
      },
      context,
    );

    expect(preview).toBeUndefined();
    expect(context.warningCollector.list()).toContain("preview_generation_failed");
    expect(context.warningCollector.listDegradations()).toContainEqual({
      feature: "preview",
      stage: "generate_preview",
      reason: "preview_generation_failed",
      affectsCorrectness: false,
      affectsFidelity: true,
    });
    expect(context.warningCollector.listDecisions()).toContainEqual({
      feature: "preview",
      requested: true,
      effective: false,
      supportLevel: "full",
      stage: "generate_preview",
      reason: "Preview generation failed and was omitted from the response.",
    });
  });
});
