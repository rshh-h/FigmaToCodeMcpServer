import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createApplication } from "../application/factory.js";
import { ServiceError, toServiceError } from "../core/errors.js";
import type { ConvertExecutionHooks, ConvertProgressUpdate } from "../core/interfaces.js";
import type { ConvertFigmaNodeUseCase, GetCapabilitiesUseCase } from "../application/useCases.js";
import {
  convertHelpRequestSchema,
  convertHelpResponseSchema,
  convertRequestSchema,
  convertResponseSchema,
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

export function createMcpApplication(env: NodeJS.ProcessEnv = process.env) {
  const app = createApplication(env);
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: PRODUCT_VERSION,
  });

  const handlers = createToolHandlers(app.convertUseCase, app.capabilitiesUseCase);

  server.registerTool(
    "figma_to_code_convert",
    {
      title: "Figma To Code Convert",
      description:
        "Convert a single Figma node into HTML, Tailwind, Flutter, SwiftUI, or Compose code. Call figma_to_code_convert_help to get a valid request template and field notes before invoking this tool.",
      inputSchema: convertRequestSchema,
      outputSchema: convertResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.convert,
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
) {
  return {
    convert: async (
      request: Parameters<ConvertFigmaNodeUseCase["execute"]>[0],
      extra?: ToolCallExtra,
    ) => {
      try {
        const response = await convertUseCase.execute(
          request,
          createProgressHooks(extra),
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Generated ${response.framework} code at ${response.code} with ${response.warnings.length} warnings.`,
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
        return toToolErrorResult(serviceError);
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
              text: `Capabilities loaded for ${response.frameworks.length} frameworks.`,
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
        return toToolErrorResult(serviceError);
      }
    },
    convertHelp: async () => {
      const response = createConvertHelpResponse();
      return {
        content: [
          {
            type: "text" as const,
            text: "Loaded figma_to_code_convert request template and field notes.",
          },
        ],
        structuredContent: response,
      };
    },
  };
}

function toToolErrorResult(error: ServiceError) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `${error.category} at ${error.stage}: ${error.message}. ${error.suggestion}`,
      },
    ],
    structuredContent: error.toJSON(),
  };
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
