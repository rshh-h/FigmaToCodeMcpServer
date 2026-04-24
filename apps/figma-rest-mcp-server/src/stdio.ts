import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isDirectEntrypoint } from "./entrypoint.js";
import { createMcpApplication } from "./mcp/server.js";

export async function startStdioServer(env: NodeJS.ProcessEnv = process.env) {
  const { server, startup } = createMcpApplication(env);
  await startup();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (isDirectEntrypoint(import.meta.url)) {
  void startStdioServer(process.env);
}
