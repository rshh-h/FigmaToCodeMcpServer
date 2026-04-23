# Service Boundaries

> How responsibilities are separated across the MCP service stack.

---

## Main Flow

The service follows a layered flow:

1. Transport receives input and validates shape.
2. Application builds request context and orchestrates the conversion flow.
3. Adapters and infrastructure fetch data, normalize it, generate artifacts, and persist outputs.
4. Transport formats the final tool response.

Concrete examples:

- `apps/figma-rest-mcp-server/src/mcp/schemas.ts` validates incoming tool input with Zod.
- `apps/figma-rest-mcp-server/src/mcp/server.ts` registers tools and calls use cases.
- `apps/figma-rest-mcp-server/src/application/useCases.ts` owns the step-by-step conversion flow.
- `apps/figma-rest-mcp-server/src/adapters/figmaRestGateway.ts` handles Figma REST fetches and cache lookup/write-through.

---

## Transport Layer Rules

Transport files should stay thin:

- Parse or validate input at the boundary.
- Call application services.
- Translate thrown errors into tool or HTTP responses.

Current examples:

- `createMcpApplication()` in `apps/figma-rest-mcp-server/src/mcp/server.ts`
- CLI/bootstrap exports in `apps/figma-rest-mcp-server/src/index.ts`

Avoid putting cache logic, raw fetch calls, or filesystem writes directly in tool handlers.

---

## Application Layer Rules

The application layer should orchestrate, not integrate directly.

Patterns used here:

- Constructor-injected dependencies for every external capability in `ConvertFigmaNodeUseCase`
- Request-scoped context created once in `apps/figma-rest-mcp-server/src/application/requestContext.ts`
- Factory composition in `apps/figma-rest-mcp-server/src/application/factory.ts`

When adding new behavior:

- Extend `core/interfaces.ts` or `core/contracts.ts` first if the new behavior crosses a boundary.
- Keep the sequence and progress reporting inside the use case.
- Push provider-specific details outward into adapters or infrastructure.
- When branching starts to spread across multiple files or stages, stop and look for a better abstraction instead of stacking one-off `if` fixes.
- Prefer reusing existing shared flows, helpers, and contracts before creating a parallel implementation path.

---

## Adapter and Infrastructure Rules

Adapters should translate or compose, while infrastructure should provide technical primitives.

Good examples:

- `FigmaRestGateway` adapts Figma REST endpoints to the `SourceGateway` contract.
- `HttpClient` centralizes retry, timeout, and error translation.
- `WorkspaceRestCacheStore` and `MemoryCache` hide caching mechanics from callers.

Do not bypass these abstractions by reaching for `fetch`, `process.env`, or ad-hoc disk paths from unrelated layers.

When changing behavior, account for configuration and parameter effects end to end:

- Environment-derived behavior belongs in `apps/figma-rest-mcp-server/src/infrastructure/config.ts` and should be considered in the final output path.
- Request parameters should be traced through schemas, use case options, adapters, and generated artifacts.
- Do not fix a symptom by hardcoding or ignoring existing parameters such as environment flags, generation modes, cache options, or embed/download toggles.

---

## Generator Package Rules

`packages/codegen-kernel` is not an HTTP service layer. It is a conversion runtime copied/adapted from a Figma plugin environment.

Implications:

- Framework-specific code belongs under folders such as `html/`, `tailwind/`, `flutter/`, `swiftui/`, and `compose/`.
- Runtime compatibility shims belong under `runtime/`.
- Shared generator helpers belong under `common/`.

Examples:

- `packages/codegen-kernel/src/runtime/figma.ts`
- `packages/codegen-kernel/src/common/renderSemantics.ts`
- `packages/codegen-kernel/src/html/htmlMain.ts`

---

## Error Boundary Rules

- Normalize backend-facing failures into `ServiceError` as early as possible.
- Include category, code, stage, suggestion, and retryability.
- Convert transport output in the outermost layer rather than leaking raw errors.

Examples:

- `apps/figma-rest-mcp-server/src/core/errors.ts`
- `apps/figma-rest-mcp-server/src/infrastructure/httpClient.ts`
- `apps/figma-rest-mcp-server/src/mcp/server.ts`

---

## Anti-Patterns

- Calling external APIs directly from `mcp/server.ts`
- Reading `process.env` deep inside adapters instead of parsing config once in `infrastructure/config.ts`
- Duplicating request orchestration in multiple entrypoints instead of extending the use case/factory path
- Mixing generated artifact formatting with transport response formatting
- Patching isolated bugs with growing `if` trees when the real issue is missing structure or abstraction
- Adding a second implementation path instead of reusing and extending an existing shared path
- Avoiding the real fix by forcing a fallback path that changes or weakens existing behavior
