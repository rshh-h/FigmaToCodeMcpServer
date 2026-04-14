import type {
  CapabilitySnapshot,
  Framework,
  FrameworkCapability,
  SourceSnapshot,
  SupportLevel,
  WorkspaceRequestOptions,
} from "../core/contracts.js";
import type { CapabilityProbe } from "../core/interfaces.js";
import type { AppConfig } from "../infrastructure/config.js";
import type { SourceGateway } from "../core/interfaces.js";

const FRAMEWORK_MODES: Record<Framework, string[]> = {
  HTML: ["html", "jsx", "styled-components", "svelte"],
  Tailwind: ["html", "jsx", "twig"],
  Flutter: ["fullApp", "stateless", "snippet"],
  SwiftUI: ["preview", "struct", "snippet"],
  Compose: ["snippet", "composable", "screen"],
};

export class CapabilityProbeAdapter implements CapabilityProbe {
  private serviceSnapshot?: CapabilitySnapshot;

  constructor(
    private readonly config: AppConfig,
    private readonly gateway: SourceGateway,
  ) {}

  async getServiceSnapshot(): Promise<CapabilitySnapshot> {
    if (this.serviceSnapshot) {
      return this.serviceSnapshot;
    }

    const frameworks: FrameworkCapability[] = Object.entries(FRAMEWORK_MODES).map(
      ([name, generationModes]) => ({
        name: name as Framework,
        supported: true,
        generationModes,
      }),
    );

    const colorVariables: SupportLevel = !this.config.ENABLE_VARIABLES ? "none" : "partial";

    this.serviceSnapshot = {
      scope: "service",
      frameworks,
      features: {
        colorVariables,
        textSegmentation: "partial",
        preview: "none",
        images: this.config.ENABLE_IMAGE_EMBED ? "partial" : "none",
        vectors: this.config.ENABLE_VECTOR_EMBED ? "partial" : "none",
        diagnostics: "full",
      },
      limits: [],
    };

    return this.serviceSnapshot;
  }

  scopeForFramework(
    snapshot: CapabilitySnapshot,
    _framework: Framework,
  ): CapabilitySnapshot {
    const vectors =
      !this.config.ENABLE_VECTOR_EMBED
        ? "none"
        : _framework === "HTML" || _framework === "Tailwind"
          ? "full"
          : "partial";

    return {
      ...snapshot,
      features: {
        ...snapshot.features,
        preview: "none",
        vectors,
      },
    };
  }

  enrichForRequest(
    serviceSnapshot: CapabilitySnapshot,
    source?: SourceSnapshot,
  ): CapabilitySnapshot {
    const next: CapabilitySnapshot = {
      ...serviceSnapshot,
      scope: "request",
      features: { ...serviceSnapshot.features },
      limits: [...serviceSnapshot.limits],
      frameworks: [...serviceSnapshot.frameworks],
    };

    if (source) {
      if (source.variablesRaw && next.features.colorVariables !== "none") {
        next.features.colorVariables = "full";
      }
    }

    return next;
  }

  async enrichWithVariableProbe(
    snapshot: CapabilitySnapshot,
    fileKey: string,
    workspace: WorkspaceRequestOptions,
  ): Promise<CapabilitySnapshot> {
    const supportsVariables = await this.gateway.probeVariables(fileKey, workspace);
    return {
      ...snapshot,
      features: {
        ...snapshot.features,
        colorVariables: !this.config.ENABLE_VARIABLES
          ? "none"
          : supportsVariables
            ? "full"
            : "partial",
      },
    };
  }
}
