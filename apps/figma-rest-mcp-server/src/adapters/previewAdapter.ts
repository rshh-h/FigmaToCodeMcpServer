import {
  generateHtmlPreviewArtifact,
} from "codegen-kernel";
import type { NormalizedTree, PreviewArtifact } from "../core/contracts.js";
import type { PreviewGenerator } from "../core/interfaces.js";
import type { RequestContext } from "../application/requestContext.js";
import {
  toKernelSettings,
} from "./kernelBridge.js";

export class PreviewAdapter implements PreviewGenerator {
  async generate(
    tree: NormalizedTree,
    _artifact: { framework: string; code: string },
    context: RequestContext,
  ): Promise<PreviewArtifact | undefined> {
    if (context.requestCapabilitySnapshot.features.preview === "none") {
      context.warningCollector.addDegradation({
        feature: "preview",
        stage: "generate_preview",
        reason: "preview_disabled",
        affectsCorrectness: false,
        affectsFidelity: true,
      });
      context.warningCollector.addDecision(
        "preview",
        true,
        false,
        "none",
        "generate_preview",
        "Preview is disabled in the current service configuration.",
      );
      return undefined;
    }

    try {
      if (!context.sourceSnapshot) {
        throw new Error("Source snapshot is required before preview generation.");
      }

      const preview = await generateHtmlPreviewArtifact({
        snapshot: context.sourceSnapshot,
        settings: toKernelSettings(context),
      });

      if (context.options.framework !== "HTML" && context.options.framework !== "Tailwind") {
        context.warningCollector.addDegradation({
          feature: "preview",
          stage: "generate_preview",
          reason: "preview_partial",
          affectsCorrectness: false,
          affectsFidelity: true,
        });
        context.warningCollector.addDecision(
          "preview",
          true,
          true,
          "partial",
          "generate_preview",
          "Preview is rendered as HTML for non-HTML frameworks.",
        );
      }

      return preview;
    } catch {
      context.warningCollector.addDegradation({
        feature: "preview",
        stage: "generate_preview",
        reason: "preview_generation_failed",
        affectsCorrectness: false,
        affectsFidelity: true,
      });
      context.warningCollector.addDecision(
        "preview",
        true,
        false,
        context.requestCapabilitySnapshot.features.preview,
        "generate_preview",
        "Preview generation failed and was omitted from the response.",
      );
      return undefined;
    }
  }
}
