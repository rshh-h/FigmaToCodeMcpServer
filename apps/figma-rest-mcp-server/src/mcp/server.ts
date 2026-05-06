import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { createApplication } from "../application/factory.js";
import { ServiceError, toServiceError } from "../core/errors.js";
import type { ConvertExecutionHooks, ConvertProgressUpdate } from "../core/interfaces.js";
import type {
  ConvertFigmaNodeUseCase,
  FetchFigmaNodeScreenshotUseCase,
  GetCapabilitiesUseCase,
} from "../application/useCases.js";
import {
  convertHelpRequestSchema,
  convertHelpResponseSchema,
  convertRequestSchema,
  convertResponseSchema,
  convertToolInputSchema,
  fetchScreenshotRequestSchema,
  fetchScreenshotResponseSchema,
  fetchScreenshotToolInputSchema,
} from "./schemas.js";
import { createConvertHelpResponse } from "./convertToolMetadata.js";
import { MCP_SERVER_NAME, PRODUCT_VERSION } from "../product.js";

const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

type ProgressToken = string | number;

type ToolCallExtra = {
  _meta?: {
    progressToken?: ProgressToken;
  };
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: ProgressToken;
      progress: number;
      total: number;
      message: string;
    };
  }) => Promise<void>;
};

type ToolHandlerOptions = {
  textFallback?: boolean;
};

export function createMcpApplication(env: NodeJS.ProcessEnv = process.env) {
  const app = createApplication(env);
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: PRODUCT_VERSION,
  });

  const handlers = createToolHandlers(
    app.convertUseCase,
    app.capabilitiesUseCase,
    app.screenshotUseCase,
    {
      textFallback: app.config.MCP_TEXT_FALLBACK,
    },
  );

  server.registerTool(
    "figma_to_code_convert",
    {
      title: "Figma To Code Convert",
      description:
        "Convert a single Figma node into HTML, Tailwind, Flutter, SwiftUI, or Compose code. If you need examples, field notes, or generation mode guidance, call figma_to_code_convert_help.",
      inputSchema: convertToolInputSchema,
      outputSchema: convertResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.convert,
  );

  server.registerTool(
    "figma_to_code_fetch_screenshot",
    {
      title: "Figma To Code Fetch Screenshot",
      description:
        "Fetch a screenshot image for a single Figma node and cache it as preview.png under the workspace cache directory.",
      inputSchema: fetchScreenshotToolInputSchema,
      outputSchema: fetchScreenshotResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.fetchScreenshot,
  );

  server.registerTool(
    "figma_to_code_convert_help",
    {
      title: "Figma To Code Convert Help",
      description:
        "Return a figma_to_code_convert request template, field descriptions, and valid generation modes.",
      inputSchema: convertHelpRequestSchema,
      outputSchema: convertHelpResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.convertHelp,
  );

  return { app, server, startup: app.startup };
}

export function createToolHandlers(
  convertUseCase: Pick<ConvertFigmaNodeUseCase, "execute">,
  capabilitiesUseCase: Pick<GetCapabilitiesUseCase, "execute">,
  screenshotUseCase: Pick<FetchFigmaNodeScreenshotUseCase, "execute">,
  options: ToolHandlerOptions = {},
) {
  return {
    convert: async (
      request: Parameters<ConvertFigmaNodeUseCase["execute"]>[0],
      extra?: ToolCallExtra,
    ) => {
      try {
        const parsedRequest = parseToolInput(
          convertRequestSchema,
          request,
          "figma_to_code_convert",
        );
        const response = await convertUseCase.execute(
          parsedRequest,
          createProgressHooks(extra),
        );
        return {
          content: [
            {
              type: "text" as const,
              text: formatToolResultText(
                `Generated ${response.framework} code at ${response.code} with ${response.warnings.length} warnings.`,
                response,
                options,
              ),
            },
          ],
          structuredContent: response,
        };
      } catch (error) {
        const serviceError = toServiceError(error, {
          category: "InternalServiceError",
          code: "unhandled_convert_error",
          stage: "generate_code",
          message: "Unexpected convert error.",
          suggestion: "Inspect the server logs and retry the request.",
          retryable: false,
        });
        return toToolErrorResult(serviceError, options);
      }
    },
    capabilities: async (
      request: Parameters<GetCapabilitiesUseCase["execute"]>[0],
    ) => {
      try {
        const response = await capabilitiesUseCase.execute(request);
        return {
          content: [
            {
              type: "text" as const,
              text: formatToolResultText(
                `Capabilities loaded for ${response.frameworks.length} frameworks.`,
                response,
                options,
              ),
            },
          ],
          structuredContent: response,
        };
      } catch (error) {
        const serviceError = toServiceError(error, {
          category: "InternalServiceError",
          code: "unhandled_capabilities_error",
          stage: "probe_capabilities",
          message: "Unexpected capabilities error.",
          suggestion: "Inspect the server logs and retry the request.",
          retryable: false,
        });
        return toToolErrorResult(serviceError, options);
      }
    },
    fetchScreenshot: async (
      request: Parameters<FetchFigmaNodeScreenshotUseCase["execute"]>[0],
    ) => {
      try {
        const parsedRequest = parseToolInput(
          fetchScreenshotRequestSchema,
          request,
          "figma_to_code_fetch_screenshot",
        );
        const response = await screenshotUseCase.execute(parsedRequest);
        return {
          content: [
            {
              type: "text" as const,
              text: formatToolResultText(
                `Fetched Figma node screenshot at ${response.screenshotPath}.`,
                response,
                options,
              ),
            },
          ],
          structuredContent: response,
        };
      } catch (error) {
        const serviceError = toServiceError(error, {
          category: "InternalServiceError",
          code: "unhandled_fetch_screenshot_error",
          stage: "fetch_snapshot",
          message: "Unexpected screenshot fetch error.",
          suggestion: "Inspect the server logs and retry the request.",
          retryable: false,
        });
        return toToolErrorResult(serviceError, options);
      }
    },
    convertHelp: async () => {
      const response = createConvertHelpResponse();
      return {
        content: [
          {
            type: "text" as const,
            text: formatToolResultText(
              "Loaded figma_to_code_convert request template and field notes.",
              response,
              options,
            ),
          },
        ],
        structuredContent: response,
      };
    },
  };
}

function toToolErrorResult(error: ServiceError, options: ToolHandlerOptions = {}) {
  const structuredContent = error.toJSON();
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: formatToolResultText(
          `${error.category} at ${error.stage}: ${error.message}. ${error.suggestion}`,
          structuredContent,
          options,
        ),
      },
    ],
    structuredContent,
  };
}

function formatToolResultText(
  summary: string,
  structuredContent: unknown,
  options: ToolHandlerOptions,
): string {
  if (!options.textFallback) {
    return summary;
  }

  return `${summary}\n\nStructured content fallback:\n${stringifyStructuredContent(structuredContent)}`;
}

function stringifyStructuredContent(structuredContent: unknown): string {
  try {
    return JSON.stringify(structuredContent, null, 2) ?? String(structuredContent);
  } catch {
    return String(structuredContent);
  }
}

function parseToolInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  toolName: string,
): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new ServiceError({
    category: "ToolValidationError",
    code: "invalid_tool_arguments",
    stage: "resolve_source",
    message: `Invalid arguments for ${toolName}: ${result.error.issues
      .map((issue) => issue.message)
      .join("; ")}`,
    suggestion: "Check the tool input fields and retry with a single Figma node URL.",
    retryable: false,
  });
}

function createProgressHooks(extra?: ToolCallExtra): ConvertExecutionHooks | undefined {
  const progressToken = extra?._meta?.progressToken;
  if (progressToken === undefined || !extra?.sendNotification) {
    return undefined;
  }

  return {
    onProgress: async (update: ConvertProgressUpdate) => {
      await extra.sendNotification?.({
        method: "notifications/progress",
        params: {
          progressToken,
          progress: update.progress,
          total: update.total,
          message: update.message,
        },
      });
    },
  };
}
