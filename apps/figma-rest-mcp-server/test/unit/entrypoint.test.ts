import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectEntrypoint } from "../../src/entrypoint.js";

describe("entrypoint", () => {
  it("detects a directly executed POSIX module", () => {
    expect(
      isDirectEntrypoint(
        "file:///Users/dev/project/dist/index.js",
        "/Users/dev/project/dist/index.js",
        "darwin",
      ),
    ).toBe(true);
  });

  it("detects a directly executed Windows module", () => {
    expect(
      isDirectEntrypoint(
        "file:///C:/Users/dev/AppData/Local/pnpm/global/5/node_modules/anchor-d2c-mcp/dist/index.js",
        "C:\\Users\\dev\\AppData\\Local\\pnpm\\global\\5\\node_modules\\anchor-d2c-mcp\\dist\\index.js",
        "win32",
      ),
    ).toBe(true);
  });

  it("rejects non-matching entrypoint paths", () => {
    expect(
      isDirectEntrypoint(
        "file:///Users/dev/project/dist/index.js",
        "/Users/dev/project/dist/stdio.js",
        "darwin",
      ),
    ).toBe(false);
  });

  it("resolves symlinks so .bin wrapper paths match the real module", () => {
    const dir = mkdtempSync(join(tmpdir(), "entrypoint-"));
    const realFile = join(dir, "index.js");
    writeFileSync(realFile, "");
    const symlinkPath = join(dir, "anchor-d2c-mcp");
    symlinkSync(realFile, symlinkPath);

    const metaUrl = pathToFileURL(realFile).href;

    expect(isDirectEntrypoint(metaUrl, symlinkPath, "darwin")).toBe(true);
  });
});
