import { describe, expect, it } from "vitest";
import { convertRequestSchema } from "../../src/mcp/schemas.js";

describe("convertRequestSchema", () => {
  it("rejects a url without node-id", () => {
    const result = convertRequestSchema.safeParse({
      source: {
        url: "https://www.figma.com/file/FILE/demo",
      },
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a url without a valid figma file key", () => {
    const result = convertRequestSchema.safeParse({
      source: {
        url: "https://www.figma.com/proto/demo?node-id=1-2",
      },
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(false);
  });

  it("accepts local asset download flags", () => {
    const result = convertRequestSchema.safeParse({
      source: {
        url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      },
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
      generationMode: "jsx",
      options: {
        downloadImagesToLocal: true,
        downloadVectorsToLocal: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("defaults local asset download flags to true", () => {
    const result = convertRequestSchema.safeParse({
      source: {
        url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      },
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(true);
    expect(result.data?.options?.downloadImagesToLocal).toBe(true);
    expect(result.data?.options?.downloadVectorsToLocal).toBe(true);
  });

  it("rejects a generationMode that does not match framework", () => {
    const result = convertRequestSchema.safeParse({
      source: {
        url: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      },
      workspaceRoot: "/tmp/workspace",
      framework: "Tailwind",
      generationMode: "screen",
    });

    expect(result.success).toBe(false);
  });
});
