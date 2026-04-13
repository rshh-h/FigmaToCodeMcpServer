import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createApplication } from "../application/factory.js";
import { ServiceError, toServiceError } from "../core/errors.js";
import type { ConvertExecutionHooks, ConvertProgressUpdate } from "../core/interfaces.js";
import type { ConvertFigmaNodeUseCase, GetCapabilitiesUseCase } from "../application/useCases.js";
import {
  capabilitiesRequestSchema,
  capabilitiesResponseSchema,
  convertRequestSchema,
  convertResponseSchema,
} from "./schemas.js";

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
    name: "figma-to-code-mcp-server",
    version: "0.0.0",
  });

  const handlers = createToolHandlers(app.convertUseCase, app.capabilitiesUseCase);

  server.registerTool(
    "figma_to_code_convert",
    {
      title: "Figma To Code Convert",
      description: `Convert a single Figma node addressed by source.url into HTML, Tailwind, Flutter, SwiftUI, or Compose code. Pass workspaceRoot to control where caches and intermediate artifacts are stored. The URL must include node-id. This tool may take a long time when the network is slow or Figma asset downloads are delayed, so wait for the result instead of retrying while a request is still running. Example request:
{
  "source": {
    "url": "https://www.figma.com/design/FILE_KEY/Example-File?node-id=1-1427&t=EXAMPLE-1"
  },
  "workspaceRoot": "/absolute/path/to/your/project",
  "useCache": true,
  "framework": "Tailwind",
  "generationMode": "jsx"
}`,
      inputSchema: convertRequestSchema,
      outputSchema: convertResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.convert,
  );

  server.registerTool(
    "figma_to_code_capabilities",
    {
      title: "Figma To Code Capabilities",
      description:
        "Return the service capability snapshot for supported frameworks and conversion features.",
      inputSchema: capabilitiesRequestSchema,
      outputSchema: capabilitiesResponseSchema,
      annotations: readOnlyAnnotations,
    },
    handlers.capabilities,
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
