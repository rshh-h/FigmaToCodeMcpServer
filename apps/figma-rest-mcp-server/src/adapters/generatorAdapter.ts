import {
  generateFrameworkArtifact,
  type KernelWarningSink,
} from "codegen-kernel";
import type {
  ConversionArtifact,
  NormalizedTree,
} from "../core/contracts.js";
import type { CodeGenerator } from "../core/interfaces.js";
import type { RequestContext } from "../application/requestContext.js";
import {
  toKernelSettings,
  treeIncludesAssets,
} from "./kernelBridge.js";

export class GeneratorAdapter implements CodeGenerator {
  async generate(
    tree: NormalizedTree,
    context: RequestContext,
  ): Promise<ConversionArtifact> {
    const assetPresence = treeIncludesAssets(tree);
    const settings = toKernelSettings(context);
    const imagesEnabled = settings.embedImages || context.options.downloadImagesToLocal === true;
    const vectorsEnabled =
      settings.embedVectors || context.options.downloadVectorsToLocal === true;

    if (assetPresence.images && !imagesEnabled) {
      context.warningCollector.addDegradation({
        feature: "images",
        stage: "generate_code",
        reason: "image_support_disabled",
        affectsCorrectness: false,
        affectsFidelity: true,
      });
      context.warningCollector.addDecision(
        "images",
        true,
        false,
        context.requestCapabilitySnapshot.features.images,
        "generate_code",
        "Image embedding is disabled by the request options or service configuration.",
      );
    }

    if (assetPresence.vectors && !vectorsEnabled) {
      context.warningCollector.addDegradation({
        feature: "vectors",
        stage: "generate_code",
        reason: "vector_support_disabled",
        affectsCorrectness: false,
        affectsFidelity: true,
      });
      context.warningCollector.addDecision(
        "vectors",
        true,
        false,
        context.requestCapabilitySnapshot.features.vectors,
        "generate_code",
        "Vector embedding is disabled by the request options or service configuration.",
      );
    }

    const warningSink: KernelWarningSink = {
      warn: (message: string) => context.warningCollector.add(message),
    };

    if (!context.sourceSnapshot) {
      throw new Error("Source snapshot is required before code generation.");
    }

    const artifact = await generateFrameworkArtifact({
      snapshot: context.sourceSnapshot,
      settings,
      warningSink,
    });

    return {
      framework: artifact.framework,
      code: artifact.code,
      warnings: context.warningCollector.list(),
    };
  }
}
