import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import {
  DEFAULT_CODEX_SERVER_KEY,
  DEFAULT_CODEX_TOOL_TIMEOUT_SEC,
  PACKAGE_NAME,
} from "./product.js";

export type InitTarget = "codex" | "claude-code" | "opencode";

export interface InitEnvironment {
  FIGMA_ACCESS_TOKEN: string;
  INCLUDE_DIAGNOSTICS: string;
  ENABLE_IMAGE_EMBED: string;
  ENABLE_VECTOR_EMBED: string;
  ROUND_TAILWIND_VALUES: string;
  ROUND_TAILWIND_COLORS: string;
}

type CliIo = {
  stdin: NodeJS.ReadableStream & { isTTY?: boolean };
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
};

function defaultFlag(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export function createInitEnvironment(
  figmaAccessToken: string,
  env: NodeJS.ProcessEnv = process.env,
): InitEnvironment {
  return {
    FIGMA_ACCESS_TOKEN: figmaAccessToken,
    INCLUDE_DIAGNOSTICS: defaultFlag(env.INCLUDE_DIAGNOSTICS, "false"),
    ENABLE_IMAGE_EMBED: defaultFlag(env.ENABLE_IMAGE_EMBED, "true"),
    ENABLE_VECTOR_EMBED: defaultFlag(env.ENABLE_VECTOR_EMBED, "true"),
    ROUND_TAILWIND_VALUES: defaultFlag(env.ROUND_TAILWIND_VALUES, "false"),
    ROUND_TAILWIND_COLORS: defaultFlag(env.ROUND_TAILWIND_COLORS, "false"),
  };
}

export function normalizeInitTarget(input: string): InitTarget | undefined {
  const normalized = input.trim().toLowerCase();
  if (normalized === "codex") {
    return "codex";
  }
  if (
    normalized === "claude-code" ||
    normalized === "claude code" ||
    normalized === "claude_code" ||
    normalized === "claude"
  ) {
    return "claude-code";
  }
  if (normalized === "opencode" || normalized === "open-code") {
    return "opencode";
  }
  return undefined;
}

export function getInitTargetPath(
  target: InitTarget,
  cwd: string = process.cwd(),
): string {
  switch (target) {
    case "codex":
      return join(homedir(), ".codex", "config.toml");
    case "claude-code":
      return join(homedir(), ".claude.json");
    case "opencode":
      return join(homedir(), ".config", "opencode", "opencode.json");
  }
}

export async function promptForFigmaAccessToken(io: CliIo): Promise<string> {
  if (!io.stdin.isTTY) {
    io.stderr.write(
      "Interactive input is unavailable; writing an empty FIGMA_ACCESS_TOKEN.\n",
    );
    return "";
  }

  const readline = createInterface({
    input: io.stdin,
    output: io.stdout,
  });

  try {
    const answer = await readline.question(
      "FIGMA_ACCESS_TOKEN (press Enter to leave it empty): ",
    );
    return answer.trim();
  } finally {
    readline.close();
  }
}

export function renderCodexConfigBlock(config: InitEnvironment): string {
  return [
    `[mcp_servers.${DEFAULT_CODEX_SERVER_KEY}]`,
    'type = "stdio"',
    `command = "${PACKAGE_NAME}"`,
    'args = ["stdio"]',
    `tool_timeout_sec = ${DEFAULT_CODEX_TOOL_TIMEOUT_SEC}`,
    "",
    `[mcp_servers.${DEFAULT_CODEX_SERVER_KEY}.env]`,
    `FIGMA_ACCESS_TOKEN = ${toTomlString(config.FIGMA_ACCESS_TOKEN)}`,
    `INCLUDE_DIAGNOSTICS = ${toTomlString(config.INCLUDE_DIAGNOSTICS)}`,
    `ENABLE_IMAGE_EMBED = ${toTomlString(config.ENABLE_IMAGE_EMBED)}`,
    `ENABLE_VECTOR_EMBED = ${toTomlString(config.ENABLE_VECTOR_EMBED)}`,
    `ROUND_TAILWIND_VALUES = ${toTomlString(config.ROUND_TAILWIND_VALUES)}`,
    `ROUND_TAILWIND_COLORS = ${toTomlString(config.ROUND_TAILWIND_COLORS)}`,
  ].join("\n");
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTomlTable(content: string, header: string): string {
  const pattern = new RegExp(
    `^\\[${escapeRegex(header)}\\]\\s*\\r?\\n(?:^(?!\\[).*(?:\\r?\\n|$))*`,
    "gm",
  );
  return content.replace(pattern, "");
}

export function updateCodexConfig(
  existingContent: string,
  config: InitEnvironment,
): string {
  const withoutEnv = stripTomlTable(
    existingContent,
    `mcp_servers.${DEFAULT_CODEX_SERVER_KEY}.env`,
  );
  const withoutServer = stripTomlTable(
    withoutEnv,
    `mcp_servers.${DEFAULT_CODEX_SERVER_KEY}`,
  ).trimEnd();
  const prefix = withoutServer ? `${withoutServer}\n\n` : "";
  return `${prefix}${renderCodexConfigBlock(config)}\n`;
}

function parseJsonc(content: string): unknown {
  const stripped = stripJsonComments(content).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

function stripJsonComments(content: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      } else if (char === "\n") {
        output += "\n";
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function buildClaudeCodeInstallArgs(config: InitEnvironment): string[] {
  const args = [
    "mcp",
    "add",
    "--transport",
    "stdio",
    "--scope",
    "user",
    PACKAGE_NAME,
  ];

  for (const [key, value] of Object.entries(config)) {
    args.push("-e", `${key}=${value}`);
  }

  args.push("--", PACKAGE_NAME, "stdio");
  return args;
}

export async function installClaudeCodeMcpServer(
  config: InitEnvironment,
  io: Pick<CliIo, "stdout" | "stderr">,
): Promise<string> {
  const args = buildClaudeCodeInstallArgs(config);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      io.stdout.write(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      io.stderr.write(String(chunk));
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            "The `claude` command was not found. Install Claude Code and ensure `claude` is available on PATH.",
          ),
        );
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`\`claude mcp add\` failed with exit code ${code ?? "unknown"}.`));
    });
  });

  return getInitTargetPath("claude-code");
}

export function updateOpenCodeConfig(
  existingContent: string,
  config: InitEnvironment,
): string {
  const root = existingContent.trim() ? asRecord(parseJsonc(existingContent)) : {};
  const mcp = asRecord(root.mcp);
  mcp[DEFAULT_CODEX_SERVER_KEY] = {
    type: "local",
    command: [PACKAGE_NAME, "stdio"],
    enabled: true,
    environment: {
      ...config,
    },
  };

  return `${JSON.stringify(
    {
      $schema:
        typeof root.$schema === "string"
          ? root.$schema
          : "https://opencode.ai/config.json",
      ...root,
      mcp,
    },
    null,
    2,
  )}\n`;
}

export async function writeInitConfig(
  target: InitTarget,
  config: InitEnvironment,
  cwd: string = process.cwd(),
): Promise<string> {
  if (target === "claude-code") {
    throw new Error("Claude Code configuration must be installed via the claude CLI.");
  }

  const configPath = getInitTargetPath(target, cwd);
  await mkdir(dirname(configPath), { recursive: true });

  let existingContent = "";
  try {
    existingContent = await readFile(configPath, "utf8");
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code !== "ENOENT") {
      throw error;
    }
  }

  const nextContent =
    target === "codex"
      ? updateCodexConfig(existingContent, config)
      : updateOpenCodeConfig(existingContent, config);

  await writeFile(configPath, nextContent, "utf8");
  return configPath;
}
