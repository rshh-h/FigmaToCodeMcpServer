import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createRequestContext } from "../../src/application/requestContext.js";
import { LocalAssetMaterializer } from "../../src/adapters/localAssets/localAssetMaterializer.js";
import type { SourceSnapshot } from "../../src/core/contracts.js";
import { readConfig } from "../../src/infrastructure/config.js";

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
          absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 120 },
          children: [
            {
              id: "1:2",
              name: "Hero",
              type: "RECTANGLE",
              visible: true,
              absoluteBoundingBox: { x: 0, y: 0, width: 60, height: 60 },
              fills: [{ type: "IMAGE", imageRef: "hero-ref" }],
              boundVariables: {
                fills: [{ id: "VariableID:brand/primary" }],
              },
            },
            {
              id: "2:1",
              name: "Icon Root",
              type: "GROUP",
              visible: true,
              absoluteBoundingBox: { x: 70, y: 0, width: 24, height: 24 },
              children: [
                {
                  id: "2:2",
                  name: "Left",
                  type: "VECTOR",
                  visible: true,
                  absoluteBoundingBox: { x: 70, y: 0, width: 12, height: 24 },
                  fillGeometry: [{}],
                  strokeGeometry: [],
                },
                {
                  id: "2:3",
                  name: "Right",
                  type: "VECTOR",
                  visible: true,
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
    vectorCandidates: [],
    vectorUrls: {},
    metadata: {
      fetchedAt: new Date(0).toISOString(),
      requestCount: 1,
    },
  };
}

function createSnapshotWithMultipleImages(): SourceSnapshot {
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
          absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 120 },
          children: [
            {
              id: "1:2",
              name: "Hero",
              type: "RECTANGLE",
              visible: true,
              absoluteBoundingBox: { x: 0, y: 0, width: 60, height: 60 },
              fills: [{ type: "IMAGE", imageRef: "hero-ref" }],
            },
            {
              id: "1:3",
              name: "Banner",
              type: "RECTANGLE",
              visible: true,
              absoluteBoundingBox: { x: 60, y: 0, width: 60, height: 60 },
              fills: [{ type: "IMAGE", imageRef: "banner-ref" }],
            },
          ],
        },
      },
    ],
    imageRefs: ["hero-ref", "banner-ref"],
    imageUrls: {},
    vectorCandidates: [],
    vectorUrls: {},
    metadata: {
      fetchedAt: new Date(0).toISOString(),
      requestCount: 1,
    },
  };
}

function createConfig(overrides: NodeJS.ProcessEnv = {}) {
  return readConfig({
    FIGMA_ACCESS_TOKEN: "token",
    FIGMA_API_BASE_URL: "https://api.figma.com",
    HTTP_TIMEOUT_MS: "10000",
    HTTP_RETRY_MAX: "0",
    HTTP_MAX_CONCURRENCY: "1",
    CACHE_TTL_MS: "1000",
    CACHE_MAX_ENTRIES: "10",
    ENABLE_VARIABLES: "true",
    ENABLE_IMAGE_EMBED: "true",
    ENABLE_VECTOR_EMBED: "true",
    ENABLE_METRICS_LOGGING: "false",
    ...overrides,
  });
}

describe("LocalAssetMaterializer", () => {
  it("downloads image assets and merged vector roots to local files", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-${Date.now()}`;
    const materializer = new LocalAssetMaterializer(
      createConfig(),
      {
        async getJson(request: { path?: string; query?: { ids?: string } }) {
          if (request.path === "/v1/files/FILE/variables/local") {
            return {
              meta: {
                variables: {
                  "VariableID:brand/primary": {
                    id: "VariableID:brand/primary",
                    name: "color.brand.primary",
                    variableCollectionId: "VariableCollectionId:brand",
                    resolvedType: "COLOR",
                    valuesByMode: {
                      "mode-light": { r: 1, g: 0, b: 0, a: 1 },
                    },
                  },
                },
                variableCollections: {
                  "VariableCollectionId:brand": {
                    id: "VariableCollectionId:brand",
                    modes: [{ modeId: "mode-light", name: "Light" }],
                  },
                },
              },
            };
          }

          if (request.path === "/v1/files/FILE/images") {
            return {
              meta: {
                images: {
                  "hero-ref": "https://cdn.example.test/hero.png",
                },
              },
            };
          }

          if (request.path === "/v1/images/FILE") {
            return {
              images: {
                "2:1": "https://cdn.example.test/icon.svg",
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary(request: { url?: string }) {
          expect(request.url).toBe("https://cdn.example.test/hero.png");
          return {
            buffer: Buffer.from("png-binary"),
            contentType: "image/png",
          };
        },
        async getText(request: { url?: string }) {
          expect(request.url).toBe("https://cdn.example.test/icon.svg");
          return '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets",
      options: {
        framework: "HTML",
        downloadImagesToLocal: true,
        downloadVectorsToLocal: true,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
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

    const snapshot = createSnapshot();
    const result = await materializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    expect(result.localImagePaths?.["hero-ref"]).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_image_hero_ref\.png$/,
    );
    expect(result.localVectorPaths?.["2:1"]).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_vector_root_2_1\.svg$/,
    );
    expect(result.localVectorRootMappings).toContainEqual({
      rootNodeId: "2:1",
      childNodeIds: ["2:2", "2:3"],
      path: result.localVectorPaths?.["2:1"],
    });
    expect(
      (
        result.variablesRaw as {
          meta?: { variables?: Record<string, { name?: string }> };
        }
      ).meta?.variables?.["VariableID:brand/primary"]?.name,
    ).toBe("color.brand.primary");
    expect(result.localAssetManifestPaths?.variableRefsPath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_node_variable_refs_file_1_1\.json$/,
    );
    expect(result.localAssetManifestPaths?.variablesResponsePath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_file_variables_file\.json$/,
    );
    expect(result.localAssetManifestPaths?.variableManifestPath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_node_variables_file_1_1\.json$/,
    );
    expect(result.localAssetManifestPaths?.imageManifestPath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_downloaded_images_file_1_1\.json$/,
    );
    expect(result.localAssetManifestPaths?.vectorManifestPath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_downloaded_vector_svgs_file_1_1\.json$/,
    );

    await access(resolve(workspaceRoot, result.localImagePaths?.["hero-ref"] ?? ""));
    await access(resolve(workspaceRoot, result.localVectorPaths?.["2:1"] ?? ""));

    expect(
      await readFile(resolve(workspaceRoot, result.localVectorPaths?.["2:1"] ?? ""), "utf8"),
    ).toContain("<svg");
  });

  it("clears snapshot fetch warnings after local image and svg recovery succeeds", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-recover-${Date.now()}`;
    const materializer = new LocalAssetMaterializer(
      createConfig(),
      {
        async getJson(request: { path?: string; query?: { ids?: string } }) {
          if (request.path === "/v1/files/FILE/variables/local") {
            return {
              meta: {
                variables: {},
                variableCollections: {},
              },
            };
          }

          if (request.path === "/v1/files/FILE/images") {
            return {
              meta: {
                images: {
                  "hero-ref": "https://cdn.example.test/hero.png",
                },
              },
            };
          }

          if (request.path === "/v1/images/FILE") {
            return {
              images: {
                "2:1": "https://cdn.example.test/icon.svg",
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary() {
          return {
            buffer: Buffer.from("png-binary"),
            contentType: "image/png",
          };
        },
        async getText() {
          return '<svg viewBox="0 0 24 24"></svg>';
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets-recover",
      options: {
        framework: "HTML",
        downloadImagesToLocal: true,
        downloadVectorsToLocal: true,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
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
    context.warningCollector.addDegradation({
      feature: "images",
      stage: "fetch_snapshot",
      reason: "image_fetch_failed",
      affectsCorrectness: false,
      affectsFidelity: true,
    });
    context.warningCollector.addDecision(
      "images",
      true,
      false,
      "partial",
      "fetch_snapshot",
      "images fetch failed and the conversion continued without embedded images.",
    );
    context.warningCollector.add("image_fetch_failed");
    context.warningCollector.addDegradation({
      feature: "vectors",
      stage: "fetch_snapshot",
      reason: "vector_fetch_failed",
      affectsCorrectness: false,
      affectsFidelity: true,
    });
    context.warningCollector.addDecision(
      "vectors",
      true,
      false,
      "partial",
      "fetch_snapshot",
      "vectors fetch failed and the conversion continued without embedded vectors.",
    );
    context.warningCollector.add("vector_fetch_failed");

    const snapshot = createSnapshot();
    await materializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    expect(context.warningCollector.list()).not.toContain("image_fetch_failed");
    expect(context.warningCollector.list()).not.toContain("vector_fetch_failed");
    expect(context.warningCollector.listDecisions()).not.toContainEqual({
      feature: "images",
      requested: true,
      effective: false,
      supportLevel: "partial",
      stage: "fetch_snapshot",
      reason: "images fetch failed and the conversion continued without embedded images.",
    });
    expect(context.warningCollector.listDecisions()).not.toContainEqual({
      feature: "vectors",
      requested: true,
      effective: false,
      supportLevel: "partial",
      stage: "fetch_snapshot",
      reason: "vectors fetch failed and the conversion continued without embedded vectors.",
    });
  });

  it("reuses cached local asset intermediates from the workspace root", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-cache-${Date.now()}`;
    const snapshot = createSnapshot();
    const baseConfig = createConfig();

    const firstMaterializer = new LocalAssetMaterializer(
      baseConfig,
      {
        async getJson(request: { path?: string; query?: { ids?: string } }) {
          if (request.path === "/v1/files/FILE/variables/local") {
            return {
              meta: {
                variables: {
                  "VariableID:brand/primary": {
                    id: "VariableID:brand/primary",
                    name: "color.brand.primary",
                  },
                },
              },
            };
          }

          if (request.path === "/v1/files/FILE/images") {
            return {
              meta: {
                images: {
                  "hero-ref": "https://cdn.example.test/hero.png",
                },
              },
            };
          }

          if (request.path === "/v1/images/FILE") {
            return {
              images: {
                "2:1": "https://cdn.example.test/icon.svg",
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary() {
          return {
            buffer: Buffer.from("png-binary"),
            contentType: "image/png",
          };
        },
        async getText() {
          return '<svg viewBox="0 0 24 24"></svg>';
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets-cache",
      options: {
        framework: "HTML",
        downloadImagesToLocal: true,
        downloadVectorsToLocal: true,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
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

    await firstMaterializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    const cachedMaterializer = new LocalAssetMaterializer(
      baseConfig,
      {
        async getJson() {
          throw new Error("cache should avoid getJson");
        },
        async getBinary() {
          throw new Error("cache should avoid getBinary");
        },
        async getText() {
          throw new Error("cache should avoid getText");
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const result = await cachedMaterializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    expect(result.localImagePaths?.["hero-ref"]).toMatch(/figma_image_hero_ref\.png$/);
    expect(result.localVectorPaths?.["2:1"]).toMatch(/figma_vector_root_2_1\.svg$/);
  });

  it("skips variable materialization when color variables are disabled", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-no-variables-${Date.now()}`;
    const requestedPaths: string[] = [];
    const materializer = new LocalAssetMaterializer(
      createConfig({ ENABLE_VARIABLES: "false" }),
      {
        async getJson(request: {
          path?: string;
          query?: { ids?: string };
        }) {
          requestedPaths.push(String(request.path));
          if (request.path === "/v1/files/FILE/images") {
            return {
              meta: {
                images: {
                  "hero-ref": "https://cdn.example.test/hero.png",
                },
              },
            };
          }

          if (request.path === "/v1/images/FILE") {
            return {
              images: {
                "2:1": "https://cdn.example.test/icon.svg",
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary() {
          return {
            buffer: Buffer.from("png-binary"),
            contentType: "image/png",
          };
        },
        async getText() {
          return '<svg viewBox="0 0 24 24"></svg>';
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets-no-variables",
      options: {
        framework: "HTML",
        useColorVariables: false,
        downloadImagesToLocal: true,
        downloadVectorsToLocal: true,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
      },
      serviceCapabilitySnapshot: {
        scope: "service",
        frameworks: [],
        features: {
          colorVariables: "none",
          textSegmentation: "partial",
          preview: "full",
          images: "partial",
          vectors: "partial",
          diagnostics: "full",
        },
        limits: [],
      },
    });

    const result = await materializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: createSnapshot().sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot: createSnapshot(),
      context,
    });

    expect(requestedPaths).not.toContain("/v1/files/FILE/variables/local");
    expect(result.variablesRaw).toBeUndefined();
    expect(result.localAssetManifestPaths?.variableManifestPath).toBeUndefined();
  });

  it("continues downloading remaining images when one local image download fails", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-partial-image-${Date.now()}`;
    const snapshot = createSnapshotWithMultipleImages();
    const materializer = new LocalAssetMaterializer(
      createConfig(),
      {
        async getJson(request: {
          path?: string;
          query?: { ids?: string };
        }) {
          if (request.path === "/v1/files/FILE/variables/local") {
            return {
              meta: {
                variables: {},
                variableCollections: {},
              },
            };
          }

          if (request.path === "/v1/files/FILE/images") {
            return {
              meta: {
                images: {
                  "hero-ref": "https://cdn.example.test/hero.png",
                  "banner-ref": "https://cdn.example.test/banner.png",
                },
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary(request: { url?: string }) {
          if (request.url === "https://cdn.example.test/banner.png") {
            throw new Error("download failed");
          }

          return {
            buffer: Buffer.from("png-binary"),
            contentType: "image/png",
          };
        },
        async getText() {
          throw new Error("unexpected svg download");
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets-partial-image",
      options: {
        framework: "HTML",
        downloadImagesToLocal: true,
        downloadVectorsToLocal: false,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
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

    const result = await materializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    expect(result.localImagePaths).toEqual({
      "hero-ref": ".figma-to-code/cache/assets/FILE/1_1/figma_image_hero_ref.png",
    });
    expect(context.warningCollector.list()).not.toContain("local_image_download_failed");
    expect(result.localAssetManifestPaths?.imageManifestPath).toMatch(
      /^\.figma-to-code\/cache\/assets\/FILE\/1_1\/figma_downloaded_images_file_1_1\.json$/,
    );
    await access(resolve(workspaceRoot, result.localImagePaths?.["hero-ref"] ?? ""));
  });

  it("deduplicates identical svg assets while preserving root mappings", async () => {
    const workspaceRoot = `/tmp/figma-local-assets-dedupe-${Date.now()}`;
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
            absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 120 },
            children: [
              {
                id: "2:1",
                name: "Icon One",
                type: "GROUP",
                visible: true,
                absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
                children: [
                  {
                    id: "2:2",
                    name: "Vector A",
                    type: "VECTOR",
                    visible: true,
                    absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
                    fillGeometry: [{}],
                    strokeGeometry: [],
                  },
                ],
              },
              {
                id: "3:1",
                name: "Icon Two",
                type: "GROUP",
                visible: true,
                absoluteBoundingBox: { x: 30, y: 0, width: 24, height: 24 },
                children: [
                  {
                    id: "3:2",
                    name: "Vector B",
                    type: "VECTOR",
                    visible: true,
                    absoluteBoundingBox: { x: 30, y: 0, width: 24, height: 24 },
                    fillGeometry: [{}],
                    strokeGeometry: [],
                  },
                ],
              },
              {
                id: "4:1",
                name: "Label",
                type: "TEXT",
                visible: true,
                absoluteBoundingBox: { x: 0, y: 40, width: 40, height: 12 },
                characters: "ignore",
              },
            ],
          },
        },
      ],
      imageRefs: [],
      imageUrls: {},
      vectorCandidates: [],
      vectorUrls: {},
      metadata: {
        fetchedAt: new Date(0).toISOString(),
        requestCount: 1,
      },
    };
    const materializer = new LocalAssetMaterializer(
      createConfig(),
      {
        async getJson(request: {
          path?: string;
          query?: { ids?: string };
        }) {
          if (request.path === "/v1/files/FILE/variables/local") {
            return {
              meta: {
                variables: {},
                variableCollections: {},
              },
            };
          }

          if (request.path === "/v1/images/FILE") {
            expect(request.query?.ids).toBe("2:1,3:1");
            return {
              images: {
                "2:1": "https://cdn.example.test/icon-a.svg",
                "3:1": "https://cdn.example.test/icon-b.svg",
              },
            };
          }

          throw new Error(`Unexpected getJson request: ${String(request.path)}`);
        },
        async getBinary() {
          throw new Error("unexpected image download");
        },
        async getText() {
          return '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
        },
      } as any,
      {
        getToken() {
          return "token";
        },
      } as any,
      {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
    );

    const context = createRequestContext({
      traceId: "trace-local-assets-dedupe",
      options: {
        framework: "HTML",
        downloadImagesToLocal: false,
        downloadVectorsToLocal: true,
      },
      workspace: {
        workspaceRoot,
        useCache: true,
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

    const result = await materializer.materialize({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:1"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-1" },
        sourceKind: "url",
      },
      gatewayData: {
        fileKey: "FILE",
        documents: snapshot.sourceNodes.map((sourceNode) => ({
          nodeId: sourceNode.nodeId,
          document: sourceNode.document,
        })),
      },
      snapshot,
      context,
    });

    expect(result.localVectorPaths?.["2:1"]).toBe(
      ".figma-to-code/cache/assets/FILE/1_1/figma_vector_root_2_1.svg",
    );
    expect(result.localVectorPaths?.["3:1"]).toBe(
      ".figma-to-code/cache/assets/FILE/1_1/figma_vector_root_2_1.svg",
    );
    expect(result.localVectorRootMappings).toContainEqual({
      rootNodeId: "2:1",
      childNodeIds: ["2:2"],
      path: ".figma-to-code/cache/assets/FILE/1_1/figma_vector_root_2_1.svg",
    });
    expect(result.localVectorRootMappings).toContainEqual({
      rootNodeId: "3:1",
      childNodeIds: ["3:2"],
      path: ".figma-to-code/cache/assets/FILE/1_1/figma_vector_root_2_1.svg",
    });

    const assetDir = resolve(workspaceRoot, ".figma-to-code/cache/assets/FILE/1_1");
    const svgFiles = (await readdir(assetDir)).filter((name) => name.endsWith(".svg"));
    expect(svgFiles).toEqual(["figma_vector_root_2_1.svg"]);
  });
});
