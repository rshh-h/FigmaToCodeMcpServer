import { describe, expect, it } from "vitest";
import {
  buildClaudeCodeInstallArgs,
  createInitEnvironment,
  renderCodexConfigBlock,
  updateCodexConfig,
  updateOpenCodeConfig,
} from "../../src/init.js";

describe("init", () => {
  it("renders the codex config block with explicit env values", () => {
    const block = renderCodexConfigBlock(
      createInitEnvironment("", {
        INCLUDE_DIAGNOSTICS: "true",
      }),
    );

    expect(block).toContain('[mcp_servers.anchor_d2c_mcp]');
    expect(block).toContain('command = "anchor-d2c-mcp"');
    expect(block).toContain('FIGMA_ACCESS_TOKEN = ""');
    expect(block).toContain('INCLUDE_DIAGNOSTICS = "true"');
  });

  it("replaces an existing codex server section without touching other content", () => {
    const existing = [
      "[mcp_servers.other]",
      'command = "other"',
      "",
      "[mcp_servers.anchor_d2c_mcp]",
      'command = "old"',
      "",
      "[mcp_servers.anchor_d2c_mcp.env]",
      'FIGMA_ACCESS_TOKEN = "old-token"',
      "",
    ].join("\n");

    const next = updateCodexConfig(existing, createInitEnvironment("new-token"));

    expect(next).toContain("[mcp_servers.other]");
    expect(next).toContain('FIGMA_ACCESS_TOKEN = "new-token"');
    expect(next).not.toContain('command = "old"');
  });

  it("merges opencode config while preserving existing keys", () => {
    const existing = [
      "{",
      '  // comment',
      '  "theme": "dark",',
      '  "mcp": {',
      '    "existing": {',
      '      "type": "local"',
      "    }",
      "  }",
      "}",
    ].join("\n");

    const next = updateOpenCodeConfig(existing, createInitEnvironment(""));

    expect(next).toContain('"theme": "dark"');
    expect(next).toContain('"existing"');
    expect(next).toContain('"anchor_d2c_mcp"');
    expect(next).toContain('"command": [');
    expect(next).toContain('"anchor-d2c-mcp"');
  });

  it("builds the claude mcp add command with stdio transport and env vars", () => {
    const args = buildClaudeCodeInstallArgs(createInitEnvironment(""));

    expect(args).toEqual([
      "mcp",
      "add",
      "--transport",
      "stdio",
      "--scope",
      "user",
      "anchor-d2c-mcp",
      "-e",
      "FIGMA_ACCESS_TOKEN=",
      "-e",
      "INCLUDE_DIAGNOSTICS=false",
      "-e",
      "ENABLE_IMAGE_EMBED=true",
      "-e",
      "ENABLE_VECTOR_EMBED=true",
      "-e",
      "ROUND_TAILWIND_VALUES=false",
      "-e",
      "ROUND_TAILWIND_COLORS=false",
      "--",
      "anchor-d2c-mcp",
      "stdio",
    ]);
  });
});
