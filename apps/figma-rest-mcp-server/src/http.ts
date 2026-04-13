import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpApplication } from "./mcp/server.js";

export function createHttpApp(
  env: NodeJS.ProcessEnv = process.env,
  runtime = createMcpApplication(env),
): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      name: "figma-to-code-mcp-server",
    });
  });

  app.all("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await runtime.server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

async function main() {
  const runtime = createMcpApplication(process.env);
  await runtime.startup();
  const app = createHttpApp(process.env, runtime);
  const port = Number(process.env.PORT ?? 3101);
  const host = process.env.HOST ?? "127.0.0.1";

  app.listen(port, host, () => {
    process.stderr.write(
      JSON.stringify({
        level: "info",
        message: "figma-to-code-mcp-server listening",
        host,
        port,
      }) + "\n",
    );
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
