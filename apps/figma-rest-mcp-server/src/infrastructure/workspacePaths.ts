import { relative, resolve, sep } from "node:path";

const WORKSPACE_METADATA_DIR = ".figma-to-code";

export function resolveWorkspaceRoot(workspaceRoot: string): string {
  return resolve(workspaceRoot);
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  ...segments: string[]
): string {
  return resolve(resolveWorkspaceRoot(workspaceRoot), ...segments);
}

export function toWorkspaceRelativePath(
  workspaceRoot: string,
  outputPath: string,
): string {
  const root = resolveWorkspaceRoot(workspaceRoot);
  const resolvedOutputPath = resolve(outputPath);
  const relativePath = relative(root, resolvedOutputPath).split(sep).join("/");

  if (!relativePath || relativePath.startsWith("..")) {
    return resolvedOutputPath;
  }

  return relativePath;
}

export function resolveLocalAssetOutputDir(
  workspaceRoot: string,
): string {
  return resolveWorkspacePath(workspaceRoot, `${WORKSPACE_METADATA_DIR}/cache/assets`);
}

export function resolveGeneratedCodeCacheDir(workspaceRoot: string): string {
  return resolveWorkspacePath(workspaceRoot, WORKSPACE_METADATA_DIR, "cache", "generated");
}

export function resolveRestCacheDir(workspaceRoot: string): string {
  return resolveWorkspacePath(workspaceRoot, WORKSPACE_METADATA_DIR, "cache", "rest");
}
