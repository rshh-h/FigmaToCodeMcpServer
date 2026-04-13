import { describe, expect, it } from "vitest";
import { WarningCollector } from "../../src/core/warnings.js";
import { ServiceError, toServiceError } from "../../src/core/errors.js";

describe("core helpers", () => {
  it("deduplicates warnings and preserves degradation metadata", () => {
    const collector = new WarningCollector();
    collector.add("warning-1");
    collector.add("warning-1");
    collector.addDegradation({
      feature: "preview",
      stage: "generate_preview",
      reason: "preview_partial",
      affectsCorrectness: false,
      affectsFidelity: true,
    });

    expect(collector.list()).toEqual(["warning-1", "preview_partial"]);
    expect(collector.listDegradations()).toEqual([
      {
        feature: "preview",
        stage: "generate_preview",
        reason: "preview_partial",
        affectsCorrectness: false,
        affectsFidelity: true,
      },
    ]);
  });

  it("normalizes unknown errors", () => {
    const serviceError = toServiceError(new Error("boom"), {
      category: "InternalServiceError",
      code: "fallback",
      stage: "generate_code",
      message: "fallback",
      suggestion: "retry",
      retryable: false,
    });

    expect(serviceError).toBeInstanceOf(ServiceError);
    expect(serviceError.message).toBe("boom");
  });
});
