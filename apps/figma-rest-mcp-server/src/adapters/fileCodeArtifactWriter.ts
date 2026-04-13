import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RequestContext } from "../application/requestContext.js";
import type { ConversionArtifact, Framework } from "../core/contracts.js";
import type { CodeArtifactWriter } from "../core/interfaces.js";
import {
  resolveGeneratedCodeCacheDir,
  toWorkspaceRelativePath,
} from "../infrastructure/workspacePaths.js";

function extensionForArtifact(
  artifact: ConversionArtifact,
  context: RequestContext,
): string {
  switch (artifact.framework) {
    case "HTML":
      switch (context.options.htmlGenerationMode) {
        case "jsx":
          return "jsx";
        case "styled-components":
          return "tsx";
        case "svelte":
          return "svelte";
        case "html":
        default:
          return "html";
      }
    case "Tailwind":
      switch (context.options.tailwindGenerationMode) {
        case "jsx":
          return "jsx";
        case "twig":
          return "twig";
        case "html":
        default:
          return "html";
      }
    case "Flutter":
      return "dart";
    case "SwiftUI":
      return "swift";
    case "Compose":
      return "kt";
    default:
      return "txt";
  }
}

function basenameForFramework(framework: Framework): string {
  return framework.toLowerCase();
}

export class FileCodeArtifactWriter implements CodeArtifactWriter {
  async write(
    artifact: ConversionArtifact,
    context: RequestContext,
  ): Promise<ConversionArtifact> {
    const extension = extensionForArtifact(artifact, context);
    const fileName = `${basenameForFramework(artifact.framework)}.${extension}`;
    const cachePath = join(
      resolveGeneratedCodeCacheDir(context.workspace.workspaceRoot),
      context.traceId,
      fileName,
    );

    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, artifact.code, "utf8");

    return {
      ...artifact,
      code: toWorkspaceRelativePath(context.workspace.workspaceRoot, cachePath),
    };
  }
}
