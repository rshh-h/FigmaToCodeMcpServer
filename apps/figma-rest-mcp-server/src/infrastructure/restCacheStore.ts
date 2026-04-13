import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveRestCacheDir } from "./workspacePaths.js";

type CacheResource = "nodes" | "images" | "vectors" | "variables";

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hashKey(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export class WorkspaceRestCacheStore {
  private getPath(
    workspaceRoot: string,
    resource: CacheResource,
    namespace: string,
    key: string,
  ): string {
    return join(
      resolveRestCacheDir(workspaceRoot),
      resource,
      slugify(namespace),
      `${hashKey(key)}.json`,
    );
  }

  async readJson<T>(
    workspaceRoot: string,
    resource: CacheResource,
    namespace: string,
    key: string,
  ): Promise<T | undefined> {
    try {
      const filePath = this.getPath(workspaceRoot, resource, namespace, key);
      return JSON.parse(await readFile(filePath, "utf8")) as T;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async writeJson(
    workspaceRoot: string,
    resource: CacheResource,
    namespace: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const filePath = this.getPath(workspaceRoot, resource, namespace, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  }
}
