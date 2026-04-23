import { describe, expect, it } from "vitest";
import { hasDirectMaskChild } from "./jsonNodeConversion.js";

describe("jsonNodeConversion", () => {
  it("detects direct mask children on groups", () => {
    expect(
      hasDirectMaskChild({
        id: "group",
        name: "Mask group",
        type: "GROUP",
        children: [
          {
            id: "mask",
            name: "Mask",
            type: "RECTANGLE",
            isMask: true,
          },
        ],
      } as any),
    ).toBe(true);
  });

  it("ignores nested mask descendants when direct children are not masks", () => {
    expect(
      hasDirectMaskChild({
        id: "group",
        name: "Outer group",
        type: "GROUP",
        children: [
          {
            id: "inner",
            name: "Inner group",
            type: "GROUP",
            children: [
              {
                id: "mask",
                name: "Mask",
                type: "RECTANGLE",
                isMask: true,
              },
            ],
          },
        ],
      } as any),
    ).toBe(false);
  });
});
