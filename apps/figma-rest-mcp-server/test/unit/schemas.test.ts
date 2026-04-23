import { describe, expect, it } from "vitest";
import {
  convertRequestSchema,
  fetchScreenshotRequestSchema,
} from "../../src/mcp/schemas.js";

describe("convertRequestSchema", () => {
  it("rejects a url without node-id", () => {
    const result = convertRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/file/FILE/demo",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a url without a valid figma file key", () => {
    const result = convertRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/proto/demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(false);
  });

  it("accepts useCache when explicitly provided", () => {
    const result = convertRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
      generationMode: "jsx",
      useCache: true,
    });

    expect(result.success).toBe(true);
  });

  it("defaults useCache to false", () => {
    const result = convertRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.success).toBe(true);
    expect(result.data?.useCache).toBe(false);
  });

  it("rejects a generationMode that does not match framework", () => {
    const result = convertRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "Tailwind",
      generationMode: "screen",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a screenshot request with useCache", () => {
    const result = fetchScreenshotRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      useCache: true,
    });

    expect(result.success).toBe(true);
  });

  it("defaults screenshot useCache to false", () => {
    const result = fetchScreenshotRequestSchema.safeParse({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
    });

    expect(result.success).toBe(true);
    expect(result.data?.useCache).toBe(false);
  });
});
