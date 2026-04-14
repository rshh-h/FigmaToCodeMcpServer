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
          name: "Variable Card",
          type: "RECTANGLE",
          visible: true,
          fills: [
            {
              type: "SOLID",
              color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
              boundVariables: {
                color: {
                  id: "VariableID:brand/primary",
                },
              },
            },
          ],
          strokes: [],
          absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 48 },
          children: [],
        },
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
            modes: [{ modeId: "mode-light", name: "Light" }],
          },
        },
        variables: {
          "VariableID:brand/primary": {
            id: "VariableID:brand/primary",
            name: "color/brand/primary",
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
      fetchedAt: new Date(0).toISOString(),
      requestCount: 1,
    },
  };
}

function createContext(framework: Framework) {
  return createRequestContext({
    traceId: `trace-color-vars-${framework.toLowerCase()}`,
    options: {
      framework,
      useColorVariables: true,
    },
    serviceCapabilitySnapshot: {
      scope: "service",
      frameworks: [],
      features: {
        colorVariables: "full",
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

describe("color variable output", () => {
  it("uses REST-fetched variable names for HTML and Tailwind color output", async () => {
    const snapshot = createSnapshot();
    const generator = new GeneratorAdapter();
    const normalizer = new NormalizationAdapter();

    const htmlContext = createContext("HTML");
    htmlContext.sourceSnapshot = snapshot;
    const htmlTree = await normalizer.normalize(snapshot, htmlContext);
    const htmlArtifact = await generator.generate(htmlTree, htmlContext);
    expect(htmlArtifact.code).toContain("var(--color-brand-primary");

    const tailwindContext = createContext("Tailwind");
    tailwindContext.sourceSnapshot = snapshot;
    const tailwindTree = await normalizer.normalize(snapshot, tailwindContext);
    const tailwindArtifact = await generator.generate(tailwindTree, tailwindContext);
    expect(tailwindArtifact.code).toContain("bg-color-brand-primary");
  });

  it("keeps the original variable id when REST variable metadata cannot be resolved", async () => {
    const snapshot = createSnapshot();
    const missingVariableId = "VariableID:missing/raw";
    (
      snapshot.sourceNodes[0].document.fills as Array<{
        boundVariables: { color: { id: string } };
      }>
    )[0].boundVariables.color.id = missingVariableId;
    snapshot.variablesRaw = {
      meta: {
        variableCollections: {},
        variables: {},
      },
    };

    const generator = new GeneratorAdapter();
    const normalizer = new NormalizationAdapter();

    const tailwindContext = createContext("Tailwind");
    tailwindContext.sourceSnapshot = snapshot;
    const tailwindTree = await normalizer.normalize(snapshot, tailwindContext);
    const tailwindArtifact = await generator.generate(tailwindTree, tailwindContext);

    expect(tailwindArtifact.code).toContain(`bg-${missingVariableId}`);
    expect(tailwindArtifact.code).not.toContain("bg-variableid-missing/raw");
  });
});
