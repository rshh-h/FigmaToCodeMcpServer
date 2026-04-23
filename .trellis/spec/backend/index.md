# Backend Development Guidelines

> Conventions for the MCP service and TypeScript backend code in this repository.

---

## Overview

This repository is a backend-first TypeScript monorepo:

- `apps/figma-rest-mcp-server/` contains the MCP server, HTTP transport, CLI, Figma REST access, caching, and diagnostics flow.
- `packages/codegen-kernel/` contains the framework-specific code generation runtime and builders.
- `packages/codegen-types/` contains shared public types and defaults.

There is no application UI layer in this repository today. Generated HTML/JSX/Tailwind output is product output, not runtime frontend code.

---

## Pre-Development Checklist

Read these files before making backend changes:

1. [Directory Structure](./directory-structure.md)
2. [Service Boundaries](./service-boundaries.md)
3. [State Management](./state-management.md)
4. [Type Safety](./type-safety.md)
5. [Quality Guidelines](./quality-guidelines.md)
6. [.trellis/spec/guides/index.md](../guides/index.md) when the change crosses layers or introduces new helpers/constants

---

## Quick Routing

- Adding or moving files: start with [Directory Structure](./directory-structure.md)
- Touching request flow or MCP handlers: read [Service Boundaries](./service-boundaries.md)
- Changing caches, request context, or runtime shims: read [State Management](./state-management.md)
- Adding schemas, contracts, or new external data: read [Type Safety](./type-safety.md)
- Finishing a change: follow [Quality Guidelines](./quality-guidelines.md)

---

## Collaboration Defaults

- Discuss the intended approach with the user before starting non-trivial code changes.
- If a change involves tradeoffs, degradation, or temporary constraints, state them explicitly at completion.
- Do not report a task as finished while the implementation is still partial.
- Prefer direct fixes that preserve existing behavior over fallback-only workarounds that avoid the real issue.

---

## Quality Check

Before considering a backend task complete, run the repository quality gate from the repo root:

```bash
pnpm type-check
pnpm test
pnpm build
```

Package-local runs are useful while iterating, but the final check should still pass at the workspace root.
