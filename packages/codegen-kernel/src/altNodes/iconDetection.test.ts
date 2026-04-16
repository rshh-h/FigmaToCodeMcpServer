import { describe, expect, it } from "vitest";
import { isLikelyIcon } from "./iconDetection";

describe("iconDetection", () => {
  it("treats styled primitive nodes as icons", () => {
    expect(
      isLikelyIcon({
        id: "1:1",
        name: "Dot",
        type: "ELLIPSE",
        width: 16,
        height: 16,
        fills: [{ type: "SOLID", visible: true, opacity: 1 }],
        strokes: [],
        exportSettings: [],
      } as any),
    ).toBe(true);
  });

  it("rejects primitive placeholders without visible style", () => {
    expect(
      isLikelyIcon({
        id: "1:2",
        name: "Placeholder",
        type: "RECTANGLE",
        width: 26,
        height: 20,
        fills: [],
        strokes: [],
        exportSettings: [],
      } as any),
    ).toBe(false);
  });
});
