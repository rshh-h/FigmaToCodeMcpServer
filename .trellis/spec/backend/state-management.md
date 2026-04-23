# State Management

> How mutable state is handled in the MCP service and generator runtime.

---

## Overview

This repository does not use a general-purpose backend state library. State is kept in explicit, narrow scopes:

- Request-scoped state for a single conversion
- Bounded process memory caches for reusable backend data
- Workspace disk caches for persisted intermediates
- Small compatibility shims in the generator runtime

---

## Request-Scoped State

Per-request state lives in a dedicated context object instead of being spread across globals.

Examples:

- `apps/figma-rest-mcp-server/src/application/requestContext.ts`
- `apps/figma-rest-mcp-server/src/core/warnings.ts`
- `apps/figma-rest-mcp-server/src/core/timing.ts`

Patterns:

- Create context once near the start of the use case.
- Pass context through downstream collaborators.
- Keep warnings, timing, feature decisions, and workspace options inside that request context.

---

## Cache State

Reusable backend state is usually expressed as explicit cache objects owned by infrastructure/adapters.

Examples:

- `apps/figma-rest-mcp-server/src/infrastructure/cache.ts`
- `apps/figma-rest-mcp-server/src/adapters/figmaRestGateway.ts`
- `apps/figma-rest-mcp-server/src/infrastructure/restCacheStore.ts`

Rules:

- Prefer bounded caches with TTL and max-entry settings.
- Key caches with stable, explicit strings such as `nodes:${fileKey}:${ids.join(",")}`.
- Use workspace disk cache only through the existing cache store helpers.

---

## Process-Wide Mutable State

There are a few compatibility-oriented exceptions in `packages/codegen-kernel` where process-wide mutable state already exists.

Examples:

- `packages/codegen-kernel/src/runtime/figma.ts`
- `packages/codegen-kernel/src/tailwind/tailwindMain.ts`

Current reality:

- `figma.ts` stores the injected runtime behind `setFigmaRuntime()` and `clearFigmaRuntime()`.
- `tailwindMain.ts` resets module-local execution state at the start of each run.

Do not copy this pattern into the MCP service unless you are extending compatibility shims around the imported Figma runtime.

---

## Derived State

Prefer pure helper functions for derived values instead of caching them prematurely.

Examples:

- `resolveGenerationModeOptions()` in `apps/figma-rest-mcp-server/src/application/useCases.ts`
- `analyzeRenderSemantics()` in `packages/codegen-kernel/src/common/renderSemantics.ts`
- `createDefaultCodegenSettings()` in `packages/codegen-types/src/index.ts`

---

## Anti-Patterns

- Hidden module-level mutable state in the service layer
- New ad-hoc `Map` or object caches without TTL/ownership rules
- Reading and mutating request state from unrelated modules instead of passing context explicitly
- Duplicating cache state in both callers and adapters
