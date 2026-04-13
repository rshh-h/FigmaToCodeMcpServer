import {
  defaultPluginSettings,
  type KernelSettings,
} from "codegen-kernel";
import type { NormalizedTree } from "../core/contracts.js";
import type { RequestContext } from "../application/requestContext.js";

export function treeIncludesAssets(tree: NormalizedTree): {
  images: boolean;
  vectors: boolean;
} {
  const queue = [...tree.roots];
  let images = false;
  let vectors = false;

  while (queue.length > 0) {
    const node = queue.shift()!;
    images ||= node.imageHints.length > 0;
    vectors ||= node.vectorHints.length > 0;
    queue.push(...node.children);
  }

  return { images, vectors };
}

export function toKernelSettings(context: RequestContext): KernelSettings {
  const defaults: KernelSettings = {
    ...defaultPluginSettings,
    framework: context.options.framework,
  };

  return {
    ...defaults,
    htmlGenerationMode: context.options.htmlGenerationMode ?? defaults.htmlGenerationMode,
    tailwindGenerationMode:
      context.options.tailwindGenerationMode ?? defaults.tailwindGenerationMode,
    flutterGenerationMode:
      context.options.flutterGenerationMode ?? defaults.flutterGenerationMode,
    swiftUIGenerationMode:
      context.options.swiftUIGenerationMode ?? defaults.swiftUIGenerationMode,
    composeGenerationMode:
      context.options.composeGenerationMode ?? defaults.composeGenerationMode,
    showLayerNames: context.options.showLayerNames ?? defaults.showLayerNames,
    useColorVariables:
      context.options.useColorVariables ?? defaults.useColorVariables,
    embedImages: context.options.embedImages ?? defaults.embedImages,
    embedVectors: context.options.embedVectors ?? defaults.embedVectors,
    roundTailwindValues:
      context.options.roundTailwindValues ?? defaults.roundTailwindValues,
    roundTailwindColors:
      context.options.roundTailwindColors ?? defaults.roundTailwindColors,
    customTailwindPrefix:
      context.options.customTailwindPrefix ?? defaults.customTailwindPrefix,
    useTailwind4: context.options.useTailwind4 ?? defaults.useTailwind4,
    baseFontSize: context.options.baseFontSize ?? defaults.baseFontSize,
    thresholdPercent: context.options.thresholdPercent ?? defaults.thresholdPercent,
    baseFontFamily: context.options.baseFontFamily ?? defaults.baseFontFamily,
    fontFamilyCustomConfig:
      context.options.fontFamilyCustomConfig ?? defaults.fontFamilyCustomConfig,
  };
}
