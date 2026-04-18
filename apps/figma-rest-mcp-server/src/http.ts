import type { Server as HttpServer } from "node:http";
import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpApplication } from "./mcp/server.js";
import { PACKAGE_NAME } from "./product.js";

export function createHttpApp(
  env: NodeJS.ProcessEnv = process.env,
  runtime = createMcpApplication(env),
): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      name: PACKAGE_NAME,
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

export async function startHttpServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<HttpServer> {
  const runtime = createMcpApplication(env);
  await runtime.startup();
  const app = createHttpApp(env, runtime);
  const port = Number(env.PORT ?? 3101);
  const host = env.HOST ?? "127.0.0.1";

  return await new Promise<HttpServer>((resolve) => {
    const server = app.listen(port, host, () => {
      process.stderr.write(
        JSON.stringify({
          level: "info",
          message: `${PACKAGE_NAME} listening`,
          host,
          port,
        }) + "\n",
      );
      resolve(server);
    });
  });
}

async function main() {
  await startHttpServer(process.env);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
