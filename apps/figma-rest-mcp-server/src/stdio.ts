import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpApplication } from "./mcp/server.js";

export async function startStdioServer(env: NodeJS.ProcessEnv = process.env) {
  const { server, startup } = createMcpApplication(env);
  await startup();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startStdioServer(process.env);
}
