import { describe, expect, it } from "vitest";
import { classifyVectorCandidate } from "../../src/adapters/svgBoundaryRules.js";

describe("svgBoundaryRules", () => {
  it("marks geometry-backed nodes as vector candidates", () => {
    const candidate = classifyVectorCandidate(
      {
        id: "1:2",
        type: "FRAME",
        fillGeometry: [],
      } as any,
      1,
    );

    expect(candidate).toEqual({
      id: "1:2",
      name: undefined,
      depth: 1,
      reason: "geometry",
    });
  });

  it("ignores non-vector nodes without geometry", () => {
    const candidate = classifyVectorCandidate(
      {
        id: "1:3",
        type: "FRAME",
      } as any,
      0,
    );

    expect(candidate).toBeUndefined();
  });
});
