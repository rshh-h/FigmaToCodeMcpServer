# Type Safety

> TypeScript and runtime validation conventions for this backend codebase.

---

## Overview

The repository relies on strict TypeScript plus runtime validation at external boundaries.

Evidence in the codebase:

- `tsconfig.base.json` enables `strict`, `isolatedModules`, and `forceConsistentCasingInFileNames`.
- `apps/figma-rest-mcp-server/src/infrastructure/config.ts` parses environment variables with Zod.
- `apps/figma-rest-mcp-server/src/mcp/schemas.ts` validates tool requests and responses with Zod.

---

## Type Organization

Use the narrowest shared location that matches the ownership of the type:

- Service-wide contracts and error shapes belong in `apps/figma-rest-mcp-server/src/core/contracts.ts`
- Service ports belong in `apps/figma-rest-mcp-server/src/core/interfaces.ts`
- Public package types shared across packages belong in `packages/codegen-types/src/index.ts`
- File-local helper types should stay local unless two or more modules genuinely share them

---

## Preferred Patterns

- Use string literal unions for finite domains such as `Framework`, `StageName`, and `ErrorCategory`.
- Use `import type` for type-only dependencies.
- Keep constructor parameters and function inputs typed explicitly at boundaries.
- Parse unknown external data before trusting it.

Examples:

- `Framework`, `GenerationMode`, and `StageName` in `apps/figma-rest-mcp-server/src/core/contracts.ts`
- `AppConfig` inferred from `configSchema` in `apps/figma-rest-mcp-server/src/infrastructure/config.ts`
- `ConvertRequestInput` inferred from `convertRequestSchema` in `apps/figma-rest-mcp-server/src/mcp/schemas.ts`

---

## Runtime Validation

Validate input at boundaries instead of letting unchecked `unknown` flow inward.

Current boundary patterns:

- Environment variables: `configSchema.parse(...)`
- MCP tool requests: `convertRequestSchema` and friends
- HTTP payloads: typed parsing around `httpClient.getJson<T>()` plus follow-up structural checks where needed

When adding a new boundary, prefer Zod or another existing parsing point over scattered manual checks.

---

## Assertions and `any`

`any` exists in the codebase, mostly around Figma plugin compatibility and legacy generator code in `packages/codegen-kernel`.

Examples:

- Scene-node bridging in `packages/codegen-kernel/src/html/htmlMain.ts`
- Figma runtime adaptation in `packages/codegen-kernel/src/runtime/runWithSourceSnapshot.ts`

Rule:

- Do not spread `any` into new service code.
- If an assertion is unavoidable, keep it local, add the narrowest cast possible, and isolate it near the external or legacy boundary.

---

## Anti-Patterns

- Exporting vague `Record<string, unknown>` shapes when a stable contract can be named
- Parsing environment variables or request payloads without a schema
- Promoting local helper types to shared modules before there is a real reuse case
- Adding broad `as any` casts in application or transport code
