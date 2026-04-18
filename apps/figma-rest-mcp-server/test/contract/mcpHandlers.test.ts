import { describe, expect, it } from "vitest";
import { createToolHandlers } from "../../src/mcp/server.js";
import { ServiceError } from "../../src/core/errors.js";

describe("MCP tool handlers", () => {
  it("returns structured convert output", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          return {
            framework: "HTML",
            code: "tmp/generated/trace/html.html",
            warnings: ["warning"],
            diagnostics: undefined,
          };
        },
      },
      {
        async execute() {
          return {
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
          };
        },
      },
    );

    const result = await handlers.convert({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.structuredContent.code).toBe("tmp/generated/trace/html.html");
    expect(result.content[0].text).toContain("Generated HTML code");
    expect(result.content[0].text).toContain("tmp/generated/trace/html.html");
  });

  it("maps tool errors into standard structured content", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          throw new ServiceError({
            category: "ToolValidationError",
            code: "multiple_targets_not_supported",
            stage: "resolve_source",
            message: "single target only",
            suggestion: "pass one node",
            retryable: false,
          });
        },
      },
      {
        async execute() {
          return {
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
          };
        },
      },
    );

    const result = await handlers.convert({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect("isError" in result && result.isError).toBe(true);
    expect(result.structuredContent.code).toBe("multiple_targets_not_supported");
    expect(result.structuredContent).toMatchObject({
      category: "ToolValidationError",
      stage: "resolve_source",
      suggestion: "pass one node",
      retryable: false,
    });
  });

  it("forwards convert progress as MCP progress notifications", async () => {
    const handlers = createToolHandlers(
      {
        async execute(_request, hooks) {
          await hooks?.onProgress?.({
            stage: "resolve_source",
            progress: 0,
            total: 2,
            message: "Resolving source",
          });
          await hooks?.onProgress?.({
            stage: "complete",
            progress: 2,
            total: 2,
            message: "Conversion complete",
          });
          return {
            framework: "HTML",
            code: "tmp/generated/trace/html.html",
            warnings: [],
            diagnostics: undefined,
          };
        },
      },
      {
        async execute() {
          return {
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
          };
        },
      },
    );

    const sendNotification = async (notification: {
      method: string;
      params: {
        progressToken: string | number;
        progress: number;
        total: number;
        message: string;
      };
    }) => {
      notifications.push(notification);
    };
    const notifications: Array<{
      method: string;
      params: {
        progressToken: string | number;
        progress: number;
        total: number;
        message: string;
      };
    }> = [];

    await handlers.convert(
      {
        figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
        workspaceRoot: "/tmp/workspace",
        framework: "HTML",
      },
      {
        _meta: {
          progressToken: "progress-1",
        },
        sendNotification,
      },
    );

    expect(notifications).toEqual([
      {
        method: "notifications/progress",
        params: {
          progressToken: "progress-1",
          progress: 0,
          total: 2,
          message: "Resolving source",
        },
      },
      {
        method: "notifications/progress",
        params: {
          progressToken: "progress-1",
          progress: 2,
          total: 2,
          message: "Conversion complete",
        },
      },
    ]);
  });

  it("returns structured capabilities output", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          throw new Error("unused");
        },
      },
      {
        async execute() {
          return {
            frameworks: [
              {
                name: "HTML",
                supported: true,
                generationModes: ["html", "jsx"],
              },
            ],
            features: {
              colorVariables: "partial",
              textSegmentation: "partial",
              preview: "full",
              images: "partial",
              vectors: "partial",
              diagnostics: "full",
            },
            limits: [],
          };
        },
      },
    );

    const result = await handlers.capabilities({
      framework: "HTML",
    });

    expect((result.structuredContent as any).features.preview).toBe("full");
    expect(result.content[0].text).toContain("Capabilities loaded");
  });

  it("returns convert help output", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          throw new Error("unused");
        },
      },
      {
        async execute() {
          return {
            frameworks: [],
            features: {
              colorVariables: "partial",
              textSegmentation: "partial",
              preview: "full",
              images: "partial",
              vectors: "partial",
              diagnostics: "full",
            },
            limits: [],
          };
        },
      },
    );

    const result = await handlers.convertHelp();

    expect((result.structuredContent as any).example.framework).toBe("Tailwind");
    expect((result.structuredContent as any).fields[0].name).toBe("figmaUrl");
    expect(result.content[0].text).toContain("request template");
  });
});
