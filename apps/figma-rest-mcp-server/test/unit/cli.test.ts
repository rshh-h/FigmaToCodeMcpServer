import { describe, expect, it } from "vitest";
import {
  parseCliArgs,
  renderHelpText,
} from "../../src/cli.js";

describe("cli", () => {
  it("parses stdio/http/init/version commands", () => {
    expect(parseCliArgs(["stdio"])).toEqual({ kind: "stdio" });
    expect(parseCliArgs(["http"])).toEqual({ kind: "http" });
    expect(parseCliArgs(["init", "codex"])).toEqual({ kind: "init", target: "codex" });
    expect(parseCliArgs(["init", "claude", "code"])).toEqual({
      kind: "init",
      target: "claude-code",
    });
    expect(parseCliArgs(["init", "claude"])).toEqual({
      kind: "init",
      target: "claude-code",
    });
    expect(parseCliArgs(["version"])).toEqual({ kind: "version" });
    expect(parseCliArgs(["--version"])).toEqual({ kind: "version" });
  });

  it("renders help text for the unified command", () => {
    const helpText = renderHelpText();

    expect(helpText).toContain("Anchor D2C MCP CLI");
    expect(helpText).toContain("anchor-d2c-mcp init codex");
    expect(helpText).toContain("claude       installs via `claude mcp add --scope user`");
    expect(helpText).toContain("anchor-d2c-mcp stdio");
    expect(helpText).toContain("anchor-d2c-mcp --version");
  });
});
