#!/usr/bin/env node

import { isDirectEntrypoint } from "./entrypoint.js";
import { runCli } from "./cli.js";

export { createHttpApp } from "./http.js";
export { runCli, parseCliArgs } from "./cli.js";
export {
  buildClaudeCodeInstallArgs,
  createInitEnvironment,
  getInitTargetPath,
  installClaudeCodeMcpServer,
  normalizeInitTarget,
  renderCodexConfigBlock,
  updateCodexConfig,
  updateOpenCodeConfig,
  writeInitConfig,
} from "./init.js";
export { startStdioServer } from "./stdio.js";
export { createMcpApplication } from "./mcp/server.js";

if (isDirectEntrypoint(import.meta.url)) {
  void runCli(process.argv.slice(2)).then((result) => {
    if (typeof result === "number" && result !== 0) {
      process.exitCode = result;
    }
  });
}
