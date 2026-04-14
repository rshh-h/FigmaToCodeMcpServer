import { describe, expect, it } from "vitest";
import { ConvertFigmaNodeUseCase } from "../../src/application/useCases.js";
import { InMemoryMetrics } from "../../src/infrastructure/metrics.js";

describe("ConvertFigmaNodeUseCase", () => {
  it("runs the main flow and returns diagnostics", async () => {
    const metrics = new InMemoryMetrics();
    const useCase = new ConvertFigmaNodeUseCase(
      { createTraceId: () => "trace-1" },
      {
        resolve() {
          return {
            fileKey: "FILE",
            nodeIds: ["1:2"],
            raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-2" },
            sourceKind: "url",
          };
        },
      },
      {
        async getServiceSnapshot() {
          return {
            scope: "service",
            frameworks: [],
            features: {
              colorVariables: "partial",
              textSegmentation: "partial",
              preview: "partial",
              images: "partial",
              vectors: "partial",
              diagnostics: "full",
            },
            limits: [],
          };
        },
        scopeForFramework(snapshot) {
          return snapshot;
        },
        enrichForRequest(snapshot) {
          return {
            ...snapshot,
            scope: "request",
          };
        },
      },
      {
        async fetchNodes() {
          return {
            fileKey: "FILE",
            documents: [
              {
                nodeId: "1:2",
                document: {
                  id: "1:2",
                  name: "Root",
                  type: "FRAME",
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
                  children: [],
                },
              },
            ],
          };
        },
        async fetchImages() {
          return {};
        },
        async fetchVectors() {
          return {};
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
      },
      {
        build(_target, gatewayData) {
          return {
            fileKey: gatewayData.fileKey,
            targetNodeIds: ["1:2"],
            sourceNodes: gatewayData.documents as any,
            imageRefs: [],
            imageUrls: {},
            vectorCandidates: [],
            vectorUrls: {},
            metadata: {
              fetchedAt: new Date().toISOString(),
              requestCount: 1,
            },
          };
        },
      },
      {
        async materialize({ snapshot }) {
          return snapshot;
        },
      },
      {
        async normalize(_snapshot) {
          return {
            fileKey: "FILE",
            rootNodeIds: ["1:2"],
            roots: [],
          };
        },
      },
      {
        async generate(_tree, context) {
          return {
            framework: context.framework,
            code: "<div />",
            warnings: context.warningCollector.list(),
          };
        },
      },
      {
        async write(artifact) {
          return {
            ...artifact,
            code: "tmp/generated/trace-1/html.html",
          };
        },
      },
      {
        async generate() {
          return {
            width: 10,
            height: 10,
            html: "<div />",
          };
        },
      },
      {
        build(context) {
          return {
            adapter: "rest",
            decisions: [],
            timing: context.stageTimer.snapshot(),
            traceId: context.traceId,
          } as any;
        },
      },
      {},
      metrics,
    );

    const result = await useCase.execute({
      source: {
        url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      },
      workspaceRoot: process.cwd(),
      framework: "HTML",
      includeDiagnostics: true,
    });

    expect(result.code).toBe("tmp/generated/trace-1/html.html");
    expect(result.preview).toBeUndefined();
    expect(result.diagnostics?.traceId).toBe("trace-1");
    expect(metrics.increments).toContainEqual({
      name: "figma_convert_request_total",
      value: 1,
      tags: { framework: "HTML" },
    });
    expect(metrics.increments).toContainEqual({
      name: "figma_convert_success_total",
      value: 1,
      tags: { framework: "HTML" },
    });
    expect(metrics.timings.some((entry) => entry.name === "figma_convert_total_ms")).toBe(true);
  });

  it("reports stage-level progress during conversion", async () => {
    const progressUpdates: Array<{
      stage: string;
      progress: number;
      total: number;
      message: string;
    }> = [];
    const useCase = new ConvertFigmaNodeUseCase(
      { createTraceId: () => "trace-progress" },
      {
        resolve() {
          return {
            fileKey: "FILE",
            nodeIds: ["1:2"],
            raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-2" },
            sourceKind: "url",
          };
        },
      },
      {
        async getServiceSnapshot() {
          return {
            scope: "service",
            frameworks: [],
            features: {
              colorVariables: "partial",
              textSegmentation: "partial",
              preview: "partial",
              images: "partial",
              vectors: "partial",
              diagnostics: "full",
            },
            limits: [],
          };
        },
        scopeForFramework(snapshot) {
          return snapshot;
        },
        enrichForRequest(snapshot) {
          return {
            ...snapshot,
            scope: "request",
          };
        },
      },
      {
        async fetchNodes() {
          return {
            fileKey: "FILE",
            documents: [
              {
                nodeId: "1:2",
                document: {
                  id: "1:2",
                  name: "Root",
                  type: "FRAME",
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
                  children: [],
                },
              },
            ],
          };
        },
        async fetchImages() {
          return {};
        },
        async fetchVectors() {
          return {};
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
      },
      {
        build(_target, gatewayData) {
          return {
            fileKey: gatewayData.fileKey,
            targetNodeIds: ["1:2"],
            sourceNodes: gatewayData.documents as any,
            imageRefs: [],
            imageUrls: {},
            vectorCandidates: [],
            vectorUrls: {},
            metadata: {
              fetchedAt: new Date().toISOString(),
              requestCount: 1,
            },
          };
        },
      },
      {
        async materialize({ snapshot }) {
          return snapshot;
        },
      },
      {
        async normalize() {
          return {
            fileKey: "FILE",
            rootNodeIds: ["1:2"],
            roots: [],
          };
        },
      },
      {
        async generate(_tree, context) {
          return {
            framework: context.framework,
            code: "<div />",
            warnings: context.warningCollector.list(),
          };
        },
      },
      {
        async write(artifact) {
          return {
            ...artifact,
            code: "tmp/generated/trace-progress/html.html",
          };
        },
      },
      {
        async generate() {
          return undefined;
        },
      },
      {
        build(context) {
          return {
            adapter: "rest",
            decisions: [],
            timing: context.stageTimer.snapshot(),
            traceId: context.traceId,
          } as any;
        },
      },
      {},
    );

    await useCase.execute(
      {
        source: {
          url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
        },
        workspaceRoot: process.cwd(),
        framework: "HTML",
        includeDiagnostics: true,
      },
      {
        onProgress(update) {
          progressUpdates.push(update);
        },
      },
    );

    expect(progressUpdates.map((update) => update.stage)).toEqual([
      "resolve_source",
      "fetch_nodes",
      "fetch_images",
      "fetch_vectors",
      "fetch_variables",
      "materialize_assets",
      "normalize",
      "generate_code",
      "write_artifact",
      "build_diagnostics",
      "complete",
    ]);
    expect(progressUpdates[0]).toMatchObject({
      progress: 0,
      total: 10,
      message: "Resolving source",
    });
    expect(progressUpdates.at(-1)).toMatchObject({
      progress: 10,
      total: 10,
      message: "Conversion complete",
    });
  });

  it("continues conversion when image/vector asset fetch fails", async () => {
    const useCase = new ConvertFigmaNodeUseCase(
      { createTraceId: () => "trace-assets" },
      {
        resolve() {
          return {
            fileKey: "FILE",
            nodeIds: ["1:2"],
            raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-2" },
            sourceKind: "url",
          };
        },
      },
      {
        async getServiceSnapshot() {
          return {
            scope: "service",
            frameworks: [],
            features: {
              colorVariables: "partial",
              textSegmentation: "partial",
              preview: "partial",
              images: "partial",
              vectors: "partial",
              diagnostics: "full",
            },
            limits: [],
          };
        },
        scopeForFramework(snapshot) {
          return snapshot;
        },
        enrichForRequest(snapshot) {
          return {
            ...snapshot,
            scope: "request",
          };
        },
      },
      {
        async fetchNodes() {
          return {
            fileKey: "FILE",
            documents: [
              {
                nodeId: "1:2",
                document: {
                  id: "1:2",
                  name: "Root",
                  type: "FRAME",
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
                  fills: [{ imageRef: "hero" }],
                  children: [],
                },
              },
            ],
          };
        },
        async fetchImages() {
          throw new Error("image fetch failed");
        },
        async fetchVectors() {
          throw new Error("vector fetch failed");
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
      },
      {
        build(_target, gatewayData, images, vectors, _variables, requestCount) {
          return {
            fileKey: gatewayData.fileKey,
            targetNodeIds: ["1:2"],
            sourceNodes: gatewayData.documents as any,
            imageRefs: ["hero"],
            imageUrls: images,
            vectorCandidates: [{ id: "vector-1", depth: 0 }],
            vectorUrls: vectors,
            metadata: {
              fetchedAt: new Date().toISOString(),
              requestCount: requestCount ?? 0,
            },
          };
        },
      },
      {
        async materialize({ snapshot }) {
          return snapshot;
        },
      },
      {
        async normalize() {
          return {
            fileKey: "FILE",
            rootNodeIds: ["1:2"],
            roots: [],
          };
        },
      },
      {
        async generate(_tree, context) {
          return {
            framework: context.framework,
            code: "<div />",
            warnings: context.warningCollector.list(),
          };
        },
      },
      {
        async write(artifact) {
          return {
            ...artifact,
            code: "tmp/generated/trace-assets/html.html",
          };
        },
      },
      {
        async generate() {
          return undefined;
        },
      },
      {
        build(context) {
          return {
            adapter: "rest",
            decisions: context.warningCollector.listDecisions(),
            timing: context.stageTimer.snapshot(),
            traceId: context.traceId,
          } as any;
        },
      },
      {},
    );

    const result = await useCase.execute({
      source: {
        url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      },
      workspaceRoot: process.cwd(),
      framework: "HTML",
      includeDiagnostics: true,
    });

    expect(result.code).toBe("tmp/generated/trace-assets/html.html");
    expect(result.warnings).toContain("image_fetch_failed");
    expect(result.warnings).toContain("vector_fetch_failed");
    expect(result.diagnostics?.decisions).toContainEqual({
      feature: "images",
      stage: "fetch_snapshot",
      requested: true,
      effective: false,
      supportLevel: "partial",
      reason: "images fetch failed and the conversion continued without embedded images.",
    });
    expect(result.diagnostics?.decisions).toContainEqual({
      feature: "vectors",
      stage: "fetch_snapshot",
      requested: true,
      effective: false,
      supportLevel: "partial",
      reason: "vectors fetch failed and the conversion continued without embedded vectors.",
    });
  });
});
