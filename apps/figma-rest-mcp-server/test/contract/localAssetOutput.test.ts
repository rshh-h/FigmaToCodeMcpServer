import { describe, expect, it } from "vitest";
import { GeneratorAdapter } from "../../src/adapters/generatorAdapter.js";
import { NormalizationAdapter } from "../../src/adapters/normalizer.js";
import { createRequestContext } from "../../src/application/requestContext.js";
import type { Framework, SourceSnapshot } from "../../src/core/contracts.js";

function createSnapshot(): SourceSnapshot {
  return {
    fileKey: "FILE",
    targetNodeIds: ["1:1"],
    sourceNodes: [
      {
        nodeId: "1:1",
        document: {
          id: "1:1",
          name: "Root",
          type: "FRAME",
          visible: true,
          layoutMode: "NONE",
          fills: [],
          strokes: [],
          absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 120 },
          children: [
            {
              id: "1:2",
              name: "Hero",
              type: "RECTANGLE",
              visible: true,
              strokes: [],
              absoluteBoundingBox: { x: 0, y: 0, width: 60, height: 60 },
              fills: [{ type: "IMAGE", imageRef: "hero-ref" }],
            },
            {
              id: "2:1",
              name: "Icon Root",
              type: "GROUP",
              visible: true,
              fills: [],
              strokes: [],
              absoluteBoundingBox: { x: 70, y: 0, width: 24, height: 24 },
              children: [
                {
                  id: "2:2",
                  name: "Left",
                  type: "VECTOR",
                  visible: true,
                  fills: [],
                  strokes: [],
                  absoluteBoundingBox: { x: 70, y: 0, width: 12, height: 24 },
                  fillGeometry: [{}],
                  strokeGeometry: [],
                },
                {
                  id: "2:3",
                  name: "Right",
                  type: "VECTOR",
                  visible: true,
                  fills: [],
                  strokes: [],
                  absoluteBoundingBox: { x: 82, y: 0, width: 12, height: 24 },
                  fillGeometry: [{}],
                  strokeGeometry: [],
                },
              ],
            },
          ],
        },
      },
    ],
    imageRefs: ["hero-ref"],
    imageUrls: {},
    localImagePaths: {
      "hero-ref": ".figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png",
    },
    vectorCandidates: [],
    vectorUrls: {},
    localVectorPaths: {
      "2:1": ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
    },
    localVectorRootMappings: [
      {
        rootNodeId: "2:1",
        childNodeIds: ["2:2", "2:3"],
        path: ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
      },
    ],
    metadata: {
      fetchedAt: new Date(0).toISOString(),
      requestCount: 1,
    },
  };
}

function createContext(framework: Framework) {
  return createRequestContext({
    traceId: `trace-local-${framework.toLowerCase()}`,
    options: {
      framework,
      embedImages: false,
      embedVectors: false,
      downloadImagesToLocal: true,
      downloadVectorsToLocal: true,
    },
    serviceCapabilitySnapshot: {
      scope: "service",
      frameworks: [],
      features: {
        colorVariables: "partial",
        textSegmentation: "partial",
        preview: framework === "HTML" || framework === "Tailwind" ? "full" : "partial",
        images: "partial",
        vectors: "partial",
        diagnostics: "full",
      },
      limits: [],
    },
  });
}

describe("local asset code output", () => {
  it("references local image and svg paths in generated code", async () => {
    const snapshot = createSnapshot();
    const generator = new GeneratorAdapter();
    const normalizer = new NormalizationAdapter();

    const frameworks: Array<{
      framework: Framework;
      expected: string[];
    }> = [
      {
        framework: "HTML",
        expected: [
          ".figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png",
          ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
        ],
      },
      {
        framework: "Tailwind",
        expected: [
          ".figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png",
          ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
        ],
      },
      {
        framework: "Flutter",
        expected: [
          "Image.asset('.figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png'",
          "SvgPicture.asset('.figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg'",
        ],
      },
      {
        framework: "Compose",
        expected: [
          ".figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png",
          ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
        ],
      },
      {
        framework: "SwiftUI",
        expected: [
          ".figma-to-code/cache/assets/FILE/1-1/figma-image-hero-ref.png",
          ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-2-1.svg",
        ],
      },
    ];

    for (const item of frameworks) {
      const context = createContext(item.framework);
      context.sourceSnapshot = snapshot;
      const tree = await normalizer.normalize(snapshot, context);
      const artifact = await generator.generate(tree, context);

      for (const expected of item.expected) {
        expect(artifact.code).toContain(expected);
      }
    }
  });

  it("keeps image-backed frames when they also contain vector overlay children", async () => {
    const snapshot: SourceSnapshot = {
      fileKey: "FILE",
      targetNodeIds: ["1:1"],
      sourceNodes: [
        {
          nodeId: "1:1",
          document: {
            id: "1:1",
            name: "Root",
            type: "FRAME",
            visible: true,
            layoutMode: "NONE",
            fills: [],
            strokes: [],
            absoluteBoundingBox: { x: 0, y: 0, width: 128, height: 128 },
            children: [
              {
                id: "1:2",
                name: "Photo",
                type: "FRAME",
                visible: true,
                layoutMode: "NONE",
                clipsContent: true,
                fills: [{ type: "IMAGE", imageRef: "photo-ref" }],
                strokes: [],
                absoluteBoundingBox: { x: 0, y: 0, width: 128, height: 128 },
                children: [
                  {
                    id: "1:2:1",
                    name: "Selection",
                    type: "VECTOR",
                    visible: true,
                    fills: [],
                    strokes: [],
                    absoluteBoundingBox: { x: 97, y: 6, width: 26, height: 26 },
                    fillGeometry: [{}],
                    strokeGeometry: [{}],
                  },
                ],
              },
            ],
          },
        },
      ],
      imageRefs: ["photo-ref"],
      imageUrls: {},
      localImagePaths: {
        "photo-ref": ".figma-to-code/cache/assets/FILE/1-1/figma-image-photo-ref.png",
      },
      vectorCandidates: [],
      vectorUrls: {},
      localVectorPaths: {
        "1:2:1": ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-1-2-1.svg",
      },
      localVectorRootMappings: [
        {
          rootNodeId: "1:2:1",
          childNodeIds: [],
          path: ".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-1-2-1.svg",
        },
      ],
      metadata: {
        fetchedAt: new Date(0).toISOString(),
        requestCount: 1,
      },
    };

    const generator = new GeneratorAdapter();
    const normalizer = new NormalizationAdapter();

    const context = createContext("Tailwind");
    context.sourceSnapshot = snapshot;

    const tree = await normalizer.normalize(snapshot, context);
    const artifact = await generator.generate(tree, context);

    expect(artifact.code).toContain(
      '<img className="w-full h-full left-0 top-0 absolute" src=".figma-to-code/cache/assets/FILE/1-1/figma-image-photo-ref.png" />',
    );
    expect(artifact.code).toContain(
      'src=".figma-to-code/cache/assets/FILE/1-1/figma-vector-root-1-2-1.svg"',
    );
  });
});
