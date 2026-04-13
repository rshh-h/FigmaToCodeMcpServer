import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FileCodeArtifactWriter } from "../../src/adapters/fileCodeArtifactWriter.js";
import { createRequestContext } from "../../src/application/requestContext.js";

describe("FileCodeArtifactWriter", () => {
  it("writes compose code to the cache directory and returns the relative cache path", async () => {
    const workspaceRoot = `/tmp/file-code-writer-${Date.now()}`;
    const writer = new FileCodeArtifactWriter();
    const context = createRequestContext({
      traceId: "trace-compose",
      options: {
        framework: "Compose",
      },
      workspace: {
        workspaceRoot,
      },
      serviceCapabilitySnapshot: {
        scope: "service",
        frameworks: [],
        features: {
          colorVariables: "partial",
          textSegmentation: "partial",
          preview: "partial",
          images: "partial",
          vectors: "partial",
          diagnostics: "full",
        },
        limits: [],
      },
    });

    const result = await writer.write(
      {
        framework: "Compose",
        code: "@Composable\nfun Demo() {}",
        warnings: [],
      },
      context,
    );

    expect(result.code).toBe(".figma-to-code/cache/generated/trace-compose/compose.kt");
    expect(await readFile(resolve(workspaceRoot, result.code), "utf8")).toBe("@Composable\nfun Demo() {}");
  });
});
