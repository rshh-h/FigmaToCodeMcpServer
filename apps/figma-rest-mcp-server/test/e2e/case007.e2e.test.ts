import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CapabilityProbeAdapter } from "../../src/adapters/capabilityProbe.js";
import { GeneratorAdapter } from "../../src/adapters/generatorAdapter.js";
import { NoopAssetMaterializer } from "../../src/adapters/localAssets/noopAssetMaterializer.js";
import { NoopCodeArtifactWriter } from "../../src/adapters/noopCodeArtifactWriter.js";
import { NormalizationAdapter } from "../../src/adapters/normalizer.js";
import { PreviewAdapter } from "../../src/adapters/previewAdapter.js";
import { SourceSnapshotAdapter } from "../../src/adapters/sourceSnapshotAdapter.js";
import { FigmaLinkParserAdapter } from "../../src/adapters/sourceResolver.js";
import { DefaultDiagnosticsBuilder } from "../../src/application/diagnosticsBuilder.js";
import { ConvertFigmaNodeUseCase } from "../../src/application/useCases.js";
import { readConfig } from "../../src/infrastructure/config.js";

async function loadCase007() {
  const fixturesRoot = join(process.cwd(), "test/fixtures");
  const manifest = JSON.parse(
    await readFile(join(fixturesRoot, "real-cases.json"), "utf8"),
  );
  const entry = manifest.case007;
  const nodePayload = JSON.parse(
    await readFile(join(fixturesRoot, entry.nodeJsonPath), "utf8"),
  );
  const imageAssets = JSON.parse(
    await readFile(join(fixturesRoot, entry.imageAssetsPath), "utf8"),
  );
  const vectorAssets = JSON.parse(
    await readFile(join(fixturesRoot, entry.vectorAssetsPath), "utf8"),
  );

  return {
    fileKey: entry.fileKey,
    nodeId: entry.nodeId,
    nodePayload,
    imageUrls: imageAssets.imageUrls,
    vectorUrls: vectorAssets.vectorUrls,
  };
}

describe("case-007 mocked e2e", () => {
  it("converts a real case fixture through the full service pipeline", async () => {
    const fixture = await loadCase007();
    const sourceGateway = {
      async fetchNodes(target: { fileKey: string; nodeIds: string[] }) {
        return {
          fileKey: target.fileKey,
          documents: target.nodeIds.map((nodeId) => ({
            nodeId,
            document: fixture.nodePayload.nodes[nodeId].document,
          })),
        };
      },
      async fetchImages() {
        return fixture.imageUrls;
      },
      async fetchVectors(_fileKey: string, ids: string[]) {
        return Object.fromEntries(
          ids
            .filter((id) => fixture.vectorUrls[id])
            .map((id) => [id, fixture.vectorUrls[id]]),
        );
      },
      async fetchVariables() {
        return undefined;
      },
      async fetchScreenshot() {
        throw new Error("unused");
      },
      async probeVariables() {
        return false;
      },
    };

    const capabilityProbe = new CapabilityProbeAdapter(
      readConfig({
        FIGMA_ACCESS_TOKEN: "token",
        ENABLE_IMAGE_EMBED: "true",
        ENABLE_VECTOR_EMBED: "true",
        ENABLE_VARIABLES: "true",
      }),
      sourceGateway,
    );

    const useCase = new ConvertFigmaNodeUseCase(
      { createTraceId: () => "trace-case-007" },
      new FigmaLinkParserAdapter(),
      capabilityProbe,
      sourceGateway,
      new SourceSnapshotAdapter(),
      new NoopAssetMaterializer(),
      new NormalizationAdapter(),
      new GeneratorAdapter(),
      new NoopCodeArtifactWriter(),
      new PreviewAdapter(),
      new DefaultDiagnosticsBuilder(),
      { includeDiagnostics: true },
    );

    const response = await useCase.execute({
      figmaUrl: `https://www.figma.com/design/${fixture.fileKey}/case-007?node-id=${fixture.nodeId.replace(":", "-")}`,
      workspaceRoot: process.cwd(),
      framework: "Compose",
      generationMode: "screen",
    });

    expect(response.framework).toBe("Compose");
    expect(response.code).toContain("@Composable");
    expect(response.code.length).toBeGreaterThan(100);
    expect(response.preview).toBeUndefined();
    expect(response.diagnostics?.traceId).toBe("trace-case-007");
    expect(response.diagnostics?.sourceNodeIds).toEqual([fixture.nodeId]);
    expect(response.diagnostics?.timing.fetch_snapshot).toBeGreaterThanOrEqual(0);
  });
});
