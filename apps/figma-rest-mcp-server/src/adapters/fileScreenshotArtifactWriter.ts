import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveScreenshotCacheDir, toWorkspaceRelativePath } from "../infrastructure/workspacePaths.js";
import type { ScreenshotArtifactWriter } from "../core/interfaces.js";
import type { ResolvedNodeTarget, WorkspaceRequestOptions } from "../core/contracts.js";
import { ServiceError } from "../core/errors.js";
import { nodeIdToSlug, saveBuffer } from "./localAssets/figmaScriptCommon.js";

function resolveScreenshotOutputPath(
  target: ResolvedNodeTarget,
  workspace: WorkspaceRequestOptions,
): string {
  const nodeId = target.nodeIds[0];
  return join(
    resolveScreenshotCacheDir(workspace.workspaceRoot),
    target.fileKey,
    nodeIdToSlug(nodeId),
    "Preview.png",
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class FileScreenshotArtifactWriter implements ScreenshotArtifactWriter {
  async readCached(
    target: ResolvedNodeTarget,
    workspace: WorkspaceRequestOptions,
  ): Promise<string | undefined> {
    const outputPath = resolveScreenshotOutputPath(target, workspace);
    if (!(await fileExists(outputPath))) {
      return undefined;
    }

    return toWorkspaceRelativePath(workspace.workspaceRoot, outputPath);
  }

  async write(input: {
    target: ResolvedNodeTarget;
    workspace: WorkspaceRequestOptions;
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    const normalizedContentType = input.contentType.split(";")[0]?.trim().toLowerCase();
    if (normalizedContentType !== "image/png") {
      throw new ServiceError({
        category: "ConversionFailedError",
        code: "figma_screenshot_invalid_content_type",
        stage: "write_artifact",
        message: "Figma screenshot export did not return a PNG image.",
        suggestion: "Retry the request and verify the Figma export endpoint is returning PNG content.",
        retryable: true,
        details: {
          contentType: input.contentType,
        },
      });
    }

    const outputPath = resolveScreenshotOutputPath(input.target, input.workspace);
    await saveBuffer("Preview.png", input.buffer, {
      baseDir: dirname(outputPath),
    });
    return toWorkspaceRelativePath(input.workspace.workspaceRoot, outputPath);
  }
}
