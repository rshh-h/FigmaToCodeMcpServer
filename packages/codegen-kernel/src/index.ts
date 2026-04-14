import type { ConversionPreview } from "codegen-types";
import { defaultPluginSettings } from "./runtime/defaultPluginSettings.js";
import { runWithSourceSnapshot } from "./runtime/runWithSourceSnapshot.js";
import type {
  KernelArtifact,
  KernelSettings,
  KernelSourceSnapshot,
  KernelWarningSink,
} from "./types.js";

export type {
  KernelArtifact,
  KernelSettings,
  KernelSourceSnapshot,
  KernelWarningSink,
} from "./types.js";
export { defaultPluginSettings } from "./runtime/defaultPluginSettings.js";
export { runWithSourceSnapshot } from "./runtime/runWithSourceSnapshot.js";

function toEffectiveSettings(settings: KernelSettings): KernelSettings {
  return {
    ...defaultPluginSettings,
    ...settings,
  };
}

export async function generateFrameworkArtifact(input: {
  snapshot: KernelSourceSnapshot;
  settings: KernelSettings;
  warningSink: KernelWarningSink;
}): Promise<KernelArtifact> {
  const result = await runWithSourceSnapshot({
    snapshot: input.snapshot,
    settings: toEffectiveSettings(input.settings),
    suppressLogs: true,
  });

  const codeMessage = result.codeMessage;
  if (!codeMessage) {
    throw new Error("The copied figma-to-code runtime did not emit a code message.");
  }

  for (const warning of codeMessage.warnings ?? []) {
    input.warningSink.warn(warning);
  }

  return {
    framework: codeMessage.settings.framework,
    code: codeMessage.code,
  };
}

export async function generateHtmlPreviewArtifact(input: {
  snapshot: KernelSourceSnapshot;
  settings: KernelSettings;
}): Promise<ConversionPreview> {
  const result = await runWithSourceSnapshot({
    snapshot: input.snapshot,
    settings: toEffectiveSettings(input.settings),
    suppressLogs: true,
  });

  const preview = result.codeMessage?.htmlPreview;
  if (!preview) {
    throw new Error("The copied figma-to-code runtime did not emit an HTML preview.");
  }

  return {
    width: preview.size.width,
    height: preview.size.height,
    html: preview.content,
  };
}
