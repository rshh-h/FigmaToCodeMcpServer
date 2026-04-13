import { describe, expect, it } from "vitest";
import { CapabilityProbeAdapter } from "../../src/adapters/capabilityProbe.js";
import { readConfig } from "../../src/infrastructure/config.js";

describe("CapabilityProbeAdapter", () => {
  it("builds the service snapshot from config", async () => {
    const probe = new CapabilityProbeAdapter(
      readConfig({
        ENABLE_VARIABLES: "false",
        ENABLE_PREVIEW: "true",
      }),
      {
        async fetchNodes() {
          throw new Error("unused");
        },
        async fetchImages() {
          throw new Error("unused");
        },
        async fetchVectors() {
          throw new Error("unused");
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
      },
    );

    const snapshot = await probe.getServiceSnapshot();
    expect(snapshot.features.colorVariables).toBe("none");
    expect(snapshot.features.preview).toBe("partial");
    expect(snapshot.limits).toEqual([]);
    expect(probe.scopeForFramework(snapshot, "HTML").features.preview).toBe("full");
    expect(probe.scopeForFramework(snapshot, "Compose").features.preview).toBe("partial");
    expect(probe.scopeForFramework(snapshot, "HTML").features.vectors).toBe("full");
    expect(probe.scopeForFramework(snapshot, "Compose").features.vectors).toBe("partial");
  });

  it("does not probe authentication when building service capabilities", async () => {
    let authProbeCalls = 0;
    const probe = new CapabilityProbeAdapter(
      readConfig({
        FIGMA_ACCESS_TOKEN: "token",
      }),
      {
        async fetchNodes() {
          throw new Error("unused");
        },
        async fetchImages() {
          throw new Error("unused");
        },
        async fetchVectors() {
          throw new Error("unused");
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
        async probeAuthentication() {
          authProbeCalls += 1;
          return false;
        },
      },
    );

    const snapshot = await probe.getServiceSnapshot();
    expect(snapshot.limits).toEqual([]);
    expect(authProbeCalls).toBe(0);
  });

  it("does not downgrade asset capability just because the source has no assets", async () => {
    const probe = new CapabilityProbeAdapter(
      readConfig({
        FIGMA_ACCESS_TOKEN: "token",
      }),
      {
        async fetchNodes() {
          throw new Error("unused");
        },
        async fetchImages() {
          throw new Error("unused");
        },
        async fetchVectors() {
          throw new Error("unused");
        },
        async fetchVariables() {
          return undefined;
        },
        async probeVariables() {
          return false;
        },
      },
    );
    const service = probe.scopeForFramework(await probe.getServiceSnapshot(), "HTML");
    const request = probe.enrichForRequest(service, {
      fileKey: "FILE",
      targetNodeIds: ["1:2"],
      sourceNodes: [],
      imageRefs: [],
      imageUrls: {},
      vectorCandidates: [],
      vectorUrls: {},
      metadata: {
        fetchedAt: new Date(0).toISOString(),
        requestCount: 1,
      },
    });

    expect(request.features.vectors).toBe("full");
    expect(request.features.images).toBe("partial");
  });
});
