import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { toWorkspaceRelativePath } from "../../infrastructure/workspacePaths.js";

export function nodeIdToSlug(nodeId: string): string {
  return toSnakeCaseSlug(nodeId);
}

export function toSnakeCaseSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "asset";
}

export function resolveOutputDir(baseDir: string): string {
  return resolve(baseDir);
}

export function toRepoRelativePath(workspaceRoot: string, outputPath: string): string {
  return toWorkspaceRelativePath(workspaceRoot, outputPath);
}

async function ensureOutputDir(baseDir: string): Promise<void> {
  await mkdir(resolveOutputDir(baseDir), { recursive: true });
}

function getOutputPath(filename: string, baseDir: string): string {
  return join(resolveOutputDir(baseDir), filename);
}

export async function saveJson(
  filename: string,
  data: unknown,
  options: { baseDir: string },
): Promise<string> {
  await ensureOutputDir(options.baseDir);
  const outputPath = getOutputPath(filename, options.baseDir);
  await writeFile(outputPath, JSON.stringify(data, null, 2), "utf8");
  return outputPath;
}

export async function saveText(
  filename: string,
  content: string,
  options: { baseDir: string },
): Promise<string> {
  await ensureOutputDir(options.baseDir);
  const outputPath = getOutputPath(filename, options.baseDir);
  await writeFile(outputPath, content, "utf8");
  return outputPath;
}

export async function saveBuffer(
  filename: string,
  content: Buffer,
  options: { baseDir: string },
): Promise<string> {
  await ensureOutputDir(options.baseDir);
  const outputPath = getOutputPath(filename, options.baseDir);
  await writeFile(outputPath, content);
  return outputPath;
}

export function extensionFromContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();

  switch (normalized) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export function buildSyntheticNodeJson(
  nodeId: string,
  document: Record<string, unknown>,
): Record<string, unknown> {
  return {
    nodes: {
      [nodeId]: {
        document,
      },
    },
  };
}
