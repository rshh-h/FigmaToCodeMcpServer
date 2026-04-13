import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Framework, SourceSnapshot } from "../../src/core/contracts.js";
import { GeneratorAdapter } from "../../src/adapters/generatorAdapter.js";
import { NormalizationAdapter } from "../../src/adapters/normalizer.js";
import { PreviewAdapter } from "../../src/adapters/previewAdapter.js";
import { createRequestContext } from "../../src/application/requestContext.js";

const FIXTURE_NAME = "figma-node-ANONFILEKEY1234567890AB-1-1427.json";

async function loadRestSnapshot(): Promise<SourceSnapshot> {
  const fixturePath = join(process.cwd(), "test/fixtures/rest", FIXTURE_NAME);
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  const nodeId = Object.keys(raw.nodes)[0];
  const document = raw.nodes[nodeId]?.document;

  return {
    fileKey: "ANONFILEKEY1234567890AB",
    targetNodeIds: [nodeId],
    sourceNodes: [{ nodeId, document }],
    imageRefs: [],
    imageUrls: {},
    vectorCandidates: [],
    vectorUrls: {},
    metadata: {
      fetchedAt: new Date(0).toISOString(),
      requestCount: 1,
    },
  };
}

async function loadGolden(name: string) {
  return await readFile(join(process.cwd(), "test/golden/rest", name), "utf8");
}

function createContext(framework: Framework) {
  const context = createRequestContext({
    traceId: `trace-${framework.toLowerCase()}`,
    options: {
      framework,
      useColorVariables: false,
      embedImages: false,
      embedVectors: false,
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

  return context;
}

describe("framework golden outputs", () => {
  it("matches the copied adapter runtime outputs for every framework", async () => {
    const snapshot = await loadRestSnapshot();
    const generator = new GeneratorAdapter();
    const normalizer = new NormalizationAdapter();

    const frameworks: Array<{
      framework: Framework;
      golden: string;
    }> = [
      { framework: "HTML", golden: "html.txt" },
      { framework: "Tailwind", golden: "tailwind.txt" },
      { framework: "Flutter", golden: "flutter.txt" },
      { framework: "SwiftUI", golden: "swiftui.txt" },
      { framework: "Compose", golden: "compose.txt" },
    ];

    for (const item of frameworks) {
      const context = createContext(item.framework);
      context.sourceSnapshot = snapshot;
      const tree = await normalizer.normalize(snapshot, context);
      const artifact = await generator.generate(tree, context);
      expect(artifact.code.trimEnd()).toBe((await loadGolden(item.golden)).trimEnd());
    }
  });

  it("matches the copied HTML preview golden and marks non-HTML previews as partial", async () => {
    const snapshot = await loadRestSnapshot();
    const normalizer = new NormalizationAdapter();
    const previewAdapter = new PreviewAdapter();

    const htmlContext = createContext("HTML");
    htmlContext.sourceSnapshot = snapshot;
    const htmlTree = await normalizer.normalize(snapshot, htmlContext);
    const htmlPreview = await previewAdapter.generate(
      htmlTree,
      {
        framework: "HTML",
        code: "<div />",
      },
      htmlContext,
    );

    expect(htmlPreview?.width).toBe(390);
    expect(htmlPreview?.height).toBe(844);
    expect(htmlPreview?.html.trimEnd()).toBe(
      (await loadGolden("preview.html")).trimEnd(),
    );

    const composeContext = createContext("Compose");
    composeContext.sourceSnapshot = snapshot;
    const composeTree = await normalizer.normalize(snapshot, composeContext);
    const composePreview = await previewAdapter.generate(
      composeTree,
      {
        framework: "Compose",
        code: "Text()",
      },
      composeContext,
    );

    expect(composePreview?.html.trimEnd()).toBe(
      (await loadGolden("preview.html")).trimEnd(),
    );
    expect(composeContext.warningCollector.list()).toContain("preview_partial");
    expect(composeContext.warningCollector.listDegradations()).toContainEqual({
      feature: "preview",
      stage: "generate_preview",
      reason: "preview_partial",
      affectsCorrectness: false,
      affectsFidelity: true,
    });
  });
});
