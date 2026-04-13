import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NormalizationAdapter } from "../../src/adapters/normalizer.js";
import { createRequestContext } from "../../src/application/requestContext.js";

describe("NormalizationAdapter", () => {
  it("normalizes a snapshot fixture", async () => {
    const fixturePath = join(
      process.cwd(),
      "test/fixtures/node-snapshot.json",
    );
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    const adapter = new NormalizationAdapter();
    const context = createRequestContext({
      traceId: "trace",
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

    const tree = await adapter.normalize(
      {
        fileKey: "FILE123",
        targetNodeIds: ["1:2"],
        sourceNodes: [
          {
            nodeId: "1:2",
            document: fixture.nodes["1:2"].document,
          },
        ],
        imageRefs: ["image-ref-1"],
        imageUrls: {
          "image-ref-1": "https://example.com/image.png",
        },
        vectorCandidates: [],
        vectorUrls: {},
        variablesRaw: {
          meta: {
            variables: {
              "VariableID:demo/1": {
                id: "VariableID:demo/1",
                name: "color.brand.primary",
              },
            },
          },
        },
        metadata: {
          fetchedAt: new Date().toISOString(),
          requestCount: 1,
        },
      },
      context,
    );

    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(2);
    expect(tree.roots[0].children[0].textSegments).toHaveLength(2);
    expect(tree.roots[0].children[1].imageHints).toHaveLength(1);
    expect(tree.roots[0].children[1].variableBindings[0]).toEqual({
      field: "fills",
      variableId: "VariableID:1",
      variableName: "color/hero",
      variableModeId: undefined,
      variableModeName: undefined,
      variableValue: undefined,
      resolvedType: undefined,
      resolutionStatus: "resolved",
    });
  });

  it("enriches variable bindings with mode and value metadata", async () => {
    const adapter = new NormalizationAdapter();
    const context = createRequestContext({
      traceId: "trace-variable-metadata",
      options: {
        framework: "HTML",
      },
      serviceCapabilitySnapshot: {
        scope: "service",
        frameworks: [],
        features: {
          colorVariables: "full",
          textSegmentation: "partial",
          preview: "full",
          images: "partial",
          vectors: "partial",
          diagnostics: "full",
        },
        limits: [],
      },
    });

    const tree = await adapter.normalize(
      {
        fileKey: "FILE123",
        targetNodeIds: ["1:2"],
        sourceNodes: [
          {
            nodeId: "1:2",
            document: {
              id: "1:2",
              name: "Variable Card",
              type: "RECTANGLE",
              visible: true,
              absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 48 },
              fills: [
                {
                  type: "SOLID",
                  color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
                },
              ],
              boundVariables: {
                fills: [
                  {
                    id: "VariableID:brand/primary",
                  },
                ],
              },
              children: [],
            } as any,
          },
        ],
        imageRefs: [],
        imageUrls: {},
        vectorCandidates: [],
        vectorUrls: {},
        variablesRaw: {
          meta: {
            variableCollections: {
              "VariableCollectionId:brand": {
                id: "VariableCollectionId:brand",
                modes: [
                  {
                    modeId: "mode-light",
                    name: "Light",
                  },
                ],
              },
            },
            variables: {
              "VariableID:brand/primary": {
                id: "VariableID:brand/primary",
                name: "color.brand.primary",
                variableCollectionId: "VariableCollectionId:brand",
                resolvedType: "COLOR",
                valuesByMode: {
                  "mode-light": { r: 0.1, g: 0.2, b: 0.3, a: 1 },
                },
              },
            },
          },
        },
        metadata: {
          fetchedAt: new Date().toISOString(),
          requestCount: 1,
        },
      },
      context,
    );

    expect(tree.roots[0].variableBindings[0]).toEqual({
      field: "fills",
      variableId: "VariableID:brand/primary",
      variableName: "color.brand.primary",
      variableModeId: "mode-light",
      variableModeName: "Light",
      variableValue: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
      resolvedType: "COLOR",
      resolutionStatus: "resolved",
    });
  });

  it("normalizes child absoluteBoundingBox coordinates relative to their parent", async () => {
    const adapter = new NormalizationAdapter();
    const context = createRequestContext({
      traceId: "trace-relative-position",
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

    const tree = await adapter.normalize(
      {
        fileKey: "FILE123",
        targetNodeIds: ["1:2"],
        sourceNodes: [
          {
            nodeId: "1:2",
            document: {
              id: "1:2",
              name: "Parent",
              type: "FRAME",
              visible: true,
              absoluteBoundingBox: { x: 100, y: 200, width: 320, height: 180 },
              children: [
                {
                  id: "1:3",
                  name: "Child",
                  type: "RECTANGLE",
                  visible: true,
                  absoluteBoundingBox: { x: 112, y: 220, width: 64, height: 32 },
                  children: [],
                },
              ],
            } as any,
          },
        ],
        imageRefs: [],
        imageUrls: {},
        vectorCandidates: [],
        vectorUrls: {},
        metadata: {
          fetchedAt: new Date().toISOString(),
          requestCount: 1,
        },
      },
      context,
    );

    expect(tree.roots[0].x).toBe(100);
    expect(tree.roots[0].y).toBe(200);
    expect(tree.roots[0].children[0].x).toBe(12);
    expect(tree.roots[0].children[0].y).toBe(20);
  });

  it("falls back to relativeTransform for geometry when bounding boxes are missing", async () => {
    const adapter = new NormalizationAdapter();
    const context = createRequestContext({
      traceId: "trace-geometry",
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

    const tree = await adapter.normalize(
      {
        fileKey: "FILE123",
        targetNodeIds: ["1:2"],
        sourceNodes: [
          {
            nodeId: "1:2",
            document: {
              id: "1:2",
              name: "Fallback",
              type: "FRAME",
              visible: true,
              size: { x: 120, y: 48 },
              relativeTransform: [
                [1, 0, 24],
                [0, 1, 36],
              ],
              children: [],
            } as any,
          },
        ],
        imageRefs: [],
        imageUrls: {},
        vectorCandidates: [],
        vectorUrls: {},
        metadata: {
          fetchedAt: new Date().toISOString(),
          requestCount: 1,
        },
      },
      context,
    );

    expect(tree.roots[0].x).toBe(24);
    expect(tree.roots[0].y).toBe(36);
    expect(tree.roots[0].width).toBe(120);
    expect(tree.roots[0].height).toBe(48);
  });
});
