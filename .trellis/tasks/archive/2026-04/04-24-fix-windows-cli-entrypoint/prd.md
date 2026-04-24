# Fix Windows CLI Entrypoint No-op

## Problem

When `anchor-d2c-mcp` is installed with `pnpm install -g`, commands work on macOS but appear to do nothing on Windows.

## Root Cause

Executable entrypoints compare `import.meta.url` with a manually constructed `file://${process.argv[1]}` string. This matches POSIX absolute paths but fails for Windows paths because `process.argv[1]` is a native path such as `C:\...`, while `import.meta.url` is a normalized file URL such as `file:///C:/...`.

## Requirements

- The package bin `anchor-d2c-mcp` must execute CLI commands on Windows and POSIX platforms.
- Direct module entrypoints `dist/http.js` and `dist/stdio.js` must keep their existing direct-run behavior.
- Preserve existing exports and command behavior.
- Add focused unit coverage for Windows and POSIX entrypoint detection.

## Validation

- Run package unit tests for the CLI/entrypoint change.
- Run type-check for the affected package.
- Prefer the repository quality gate if time permits.
