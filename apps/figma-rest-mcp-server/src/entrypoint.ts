import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

function fileUrlToWindowsPath(metaUrl: string): string {
  const url = new URL(metaUrl);
  if (url.protocol !== "file:") {
    throw new Error(`Expected a file URL, received ${metaUrl}`);
  }

  const pathname = decodeURIComponent(url.pathname);
  const drivePath = /^\/[a-zA-Z]:/.test(pathname)
    ? pathname.slice(1)
    : pathname;
  const localPath = drivePath.replace(/\//g, "\\");

  return url.hostname ? `\\\\${url.hostname}${localPath}` : localPath;
}

function resolveEntrypointPath(
  value: string,
  platform: NodeJS.Platform,
): string {
  const pathApi = platform === "win32" ? win32 : posix;
  const resolved = pathApi.resolve(value);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isDirectEntrypoint(
  metaUrl: string,
  argvPath: string | undefined = process.argv[1],
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    const modulePath =
      platform === "win32" ? fileUrlToWindowsPath(metaUrl) : fileURLToPath(metaUrl);
    return (
      resolveEntrypointPath(modulePath, platform) ===
      resolveEntrypointPath(argvPath, platform)
    );
  } catch {
    return false;
  }
}
