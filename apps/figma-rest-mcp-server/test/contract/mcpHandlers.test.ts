import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpApplication, createToolHandlers } from "../../src/mcp/server.js";
import { ServiceError } from "../../src/core/errors.js";

const screenshotUseCase = {
  async execute() {
    return {
      screenshotPath: ".figma-to-code/cache/screenshot/FILE/1_2/preview.png",
      fileKey: "FILE",
      nodeId: "1:2",
    };
  },
};

describe("MCP tool handlers", () => {
  it("exposes tool input fields in MCP tool definitions", async () => {
    const { server } = createMcpApplication({
      FIGMA_ACCESS_TOKEN: "token",
    });
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.listTools();
      const convertTool = result.tools.find(
        (tool) => tool.name === "figma_to_code_convert",
      );
      const screenshotTool = result.tools.find(
        (tool) => tool.name === "figma_to_code_fetch_screenshot",
      );

      expect(convertTool?.inputSchema.properties).toMatchObject({
        figmaUrl: expect.any(Object),
        workspaceRoot: expect.any(Object),
        useCache: expect.any(Object),
        framework: expect.any(Object),
        generationMode: expect.any(Object),
      });
      expect(convertTool?.inputSchema.required).toEqual([
        "figmaUrl",
        "workspaceRoot",
      ]);
      expect(screenshotTool?.inputSchema.properties).toMatchObject({
        figmaUrl: expect.any(Object),
        workspaceRoot: expect.any(Object),
        useCache: expect.any(Object),
      });
      expect(screenshotTool?.inputSchema.required).toEqual([
        "figmaUrl",
        "workspaceRoot",
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

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
      screenshotUseCase,
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

  it("adds structured convert data to text when MCP text fallback is enabled", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          return {
            framework: "HTML",
            code: "tmp/generated/trace/html.html",
            warnings: ["missing image"],
            preview: {
              width: 320,
              height: 180,
              html: "<div>preview</div>",
            },
            diagnostics: {
              adapter: "rest",
              sourceFileKey: "FILE",
              sourceNodeIds: ["1:2"],
              sourceNodeCount: 1,
              decisions: [],
              timing: {
                resolve_source: 1,
                probe_capabilities: 2,
                fetch_snapshot: 3,
                normalize: 4,
                generate_code: 12,
                write_artifact: 5,
                generate_preview: 0,
                build_diagnostics: 6,
              },
            },
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
      screenshotUseCase,
      {
        textFallback: true,
      },
    );

    const result = await handlers.convert({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.content[0].text).toContain("Structured content fallback");
    expect(result.content[0].text).toContain('"warnings"');
    expect(result.content[0].text).toContain("missing image");
    expect(result.content[0].text).toContain('"preview"');
    expect(result.content[0].text).toContain('"diagnostics"');
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
      screenshotUseCase,
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

  it("keeps refined convert validation in the handler", async () => {
    const handlers = createToolHandlers(
      {
        async execute() {
          throw new Error("convert should not run with invalid input");
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
      screenshotUseCase,
    );

    const result = await handlers.convert({
      figmaUrl: "https://www.figma.com/proto/demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect("isError" in result && result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      category: "ToolValidationError",
      code: "invalid_tool_arguments",
    });
  });

  it("adds structured error data to text when MCP text fallback is enabled", async () => {
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
      screenshotUseCase,
      {
        textFallback: true,
      },
    );

    const result = await handlers.convert({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      framework: "HTML",
    });

    expect(result.content[0].text).toContain("Structured content fallback");
    expect(result.content[0].text).toContain("multiple_targets_not_supported");
    expect(result.content[0].text).toContain('"retryable": false');
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
      screenshotUseCase,
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
      screenshotUseCase,
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
      screenshotUseCase,
    );

    const result = await handlers.convertHelp();

    expect((result.structuredContent as any).example.framework).toBe("Tailwind");
    expect((result.structuredContent as any).fields[0].name).toBe("figmaUrl");
    expect(result.content[0].text).toContain("request template");
  });

  it("adds convert help data to text when MCP text fallback is enabled", async () => {
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
      screenshotUseCase,
      {
        textFallback: true,
      },
    );

    const result = await handlers.convertHelp();

    expect(result.content[0].text).toContain("Structured content fallback");
    expect(result.content[0].text).toContain('"figmaUrl"');
    expect(result.content[0].text).toContain('"workspaceRoot"');
    expect(result.content[0].text).toContain('"generationModesByFramework"');
    expect(result.content[0].text).toContain('"Tailwind"');
  });

  it("returns structured screenshot output", async () => {
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
      screenshotUseCase,
    );

    const result = await handlers.fetchScreenshot({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      useCache: true,
    });

    expect(result.content[0].text).toContain("Fetched Figma node screenshot");
    expect((result.structuredContent as any).screenshotPath).toBe(
      ".figma-to-code/cache/screenshot/FILE/1_2/preview.png",
    );
  });

  it("adds screenshot data to text when MCP text fallback is enabled", async () => {
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
      screenshotUseCase,
      {
        textFallback: true,
      },
    );

    const result = await handlers.fetchScreenshot({
      figmaUrl: "https://www.figma.com/design/FILE/Demo?node-id=1-2",
      workspaceRoot: "/tmp/workspace",
      useCache: true,
    });

    expect(result.content[0].text).toContain("Structured content fallback");
    expect(result.content[0].text).toContain('"screenshotPath"');
    expect(result.content[0].text).toContain('"fileKey": "FILE"');
    expect(result.content[0].text).toContain('"nodeId": "1:2"');
  });
});
