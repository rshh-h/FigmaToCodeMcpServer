import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FileScreenshotArtifactWriter } from "../../src/adapters/fileScreenshotArtifactWriter.js";

describe("FileScreenshotArtifactWriter", () => {
  it("writes screenshot PNGs to the asset cache and returns the relative path", async () => {
    const workspaceRoot = `/tmp/file-screenshot-writer-${Date.now()}`;
    const writer = new FileScreenshotArtifactWriter();

    const result = await writer.write({
      target: {
        fileKey: "FILE",
        nodeIds: ["1:2"],
        raw: { url: "https://www.figma.com/design/FILE/Demo?node-id=1-2" },
        sourceKind: "url",
      },
      workspace: {
        workspaceRoot,
        useCache: false,
      },
      buffer: Buffer.from("png-binary"),
      contentType: "image/png",
    });

    expect(result).toBe(".figma-to-code/cache/screenshot/FILE/1-2/Preview.png");
    expect(await readFile(resolve(workspaceRoot, result))).toEqual(Buffer.from("png-binary"));
  });
});
