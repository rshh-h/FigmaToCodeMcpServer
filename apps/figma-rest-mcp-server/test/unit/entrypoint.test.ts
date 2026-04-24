import { describe, expect, it } from "vitest";
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
});
