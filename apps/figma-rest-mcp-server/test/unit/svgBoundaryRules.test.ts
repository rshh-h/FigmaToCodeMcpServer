import { describe, expect, it } from "vitest";
import { classifyVectorCandidate } from "../../src/adapters/svgBoundaryRules.js";

describe("svgBoundaryRules", () => {
  it("marks nodes with non-empty geometry as vector candidates", () => {
    const candidate = classifyVectorCandidate(
      {
        id: "1:2",
        type: "FRAME",
        fillGeometry: [{ path: "M0 0L10 0L10 10L0 10Z" }],
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
        fillGeometry: [],
      } as any,
      0,
    );

    expect(candidate).toBeUndefined();
  });

  it("ignores hidden nodes and text nodes", () => {
    expect(
      classifyVectorCandidate(
        {
          id: "1:4",
          type: "INSTANCE",
          visible: false,
          fillGeometry: [{ path: "M0 0L10 0L10 10L0 10Z" }],
        } as any,
        0,
      ),
    ).toBeUndefined();

    expect(
      classifyVectorCandidate(
        {
          id: "1:5",
          type: "TEXT",
          fillGeometry: [{ path: "M0 0L10 0L10 10L0 10Z" }],
        } as any,
        0,
      ),
    ).toBeUndefined();
  });
});
