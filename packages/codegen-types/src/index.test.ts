import { describe, expect, it } from "vitest";
import { createDefaultCodegenSettings } from "./index.js";

describe("createDefaultCodegenSettings", () => {
  it("creates stable defaults", () => {
    const settings = createDefaultCodegenSettings("HTML");
    expect(settings.framework).toBe("HTML");
    expect(settings.htmlGenerationMode).toBe("html");
    expect(settings.baseFontSize).toBe(16);
    expect(settings.embedImages).toBe(true);
  });
});
