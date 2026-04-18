import type { Server as HttpServer } from "node:http";
import { startHttpServer } from "./http.js";
import {
  createInitEnvironment,
  installClaudeCodeMcpServer,
  normalizeInitTarget,
  promptForFigmaAccessToken,
  writeInitConfig,
} from "./init.js";
import { startStdioServer } from "./stdio.js";
import {
  PACKAGE_NAME,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_VERSION,
} from "./product.js";

type ParsedCliCommand =
  | { kind: "stdio" }
  | { kind: "http" }
  | { kind: "init"; target: "codex" | "claude-code" | "opencode" }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "invalid"; reason: string };

export function parseCliArgs(args: string[]): ParsedCliCommand {
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command === "version" || command === "--version" || command === "-v") {
    return { kind: "version" };
  }

  if (command === "stdio") {
    return { kind: "stdio" };
  }

  if (command === "http") {
    return { kind: "http" };
  }

  if (command === "init") {
    const target = normalizeInitTarget(rest.join(" "));
    if (target) {
      return { kind: "init", target };
    }
    return {
      kind: "invalid",
      reason:
        "init requires a target: codex, claude, or opencode.",
    };
  }

  return {
    kind: "invalid",
    reason:
      `Unknown command "${command}". Supported commands: init, stdio, http, help, version.`,
  };
}

export function renderHelpText(): string {
  return [
    `${PRODUCT_DISPLAY_NAME} CLI`,
    "",
    `Usage: ${PACKAGE_NAME} <command>`,
    "",
    "Commands:",
    "  init    Write MCP configuration to a supported client config file.",
    "  stdio   Start the MCP server over stdio.",
    "  http    Start the MCP server over Streamable HTTP.",
    "  help    Show this help message.",
    "  version Show the current CLI version.",
    "",
    "Init targets:",
    "  codex        ~/.codex/config.toml",
    "  claude       installs via `claude mcp add --scope user` and stores in ~/.claude.json",
    "  opencode     ~/.config/opencode/opencode.json",
    "",
    "Examples:",
    `  ${PACKAGE_NAME} init codex`,
    `  ${PACKAGE_NAME} init claude`,
    `  ${PACKAGE_NAME} init opencode`,
    `  ${PACKAGE_NAME} stdio`,
    `  ${PACKAGE_NAME} http`,
    `  ${PACKAGE_NAME} --version`,
  ].join("\n");
}

export async function runCli(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  io: {
    stdin: NodeJS.ReadableStream & { isTTY?: boolean };
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
  } = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
): Promise<number | HttpServer | void> {
  const parsed = parseCliArgs(args);

  switch (parsed.kind) {
    case "stdio":
      await startStdioServer(env);
      return;
    case "http":
      return await startHttpServer(env);
    case "init": {
      const figmaAccessToken = await promptForFigmaAccessToken(io);
      const config = createInitEnvironment(figmaAccessToken, env);
      const configPath =
        parsed.target === "claude-code"
          ? await installClaudeCodeMcpServer(config, io)
          : await writeInitConfig(parsed.target, config);
      io.stdout.write(
        `Wrote ${parsed.target} MCP config to ${configPath}.\nOpen that file to review or adjust the configuration.\n`,
      );
      return 0;
    }
    case "version":
      io.stdout.write(`${PRODUCT_VERSION}\n`);
      return 0;
    case "help":
      io.stdout.write(`${renderHelpText()}\n`);
      return 0;
    case "invalid":
      io.stderr.write(`${parsed.reason}\n\n${renderHelpText()}\n`);
      return 1;
  }
}
