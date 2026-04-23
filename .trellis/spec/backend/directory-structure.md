# Directory Structure

> How backend code is organized in this repository.

---

## Overview

The repository uses a monorepo split between one deployable app and shared packages:

- `apps/figma-rest-mcp-server/` is the executable service.
- `packages/codegen-kernel/` is shared conversion/runtime logic.
- `packages/codegen-types/` is the shared public type surface.

Add new code to the narrowest layer that owns the behavior. Do not mix transport, orchestration, and integration details into the same file.

---

## Directory Layout

```text
apps/
  figma-rest-mcp-server/
    src/
      core/
      application/
      adapters/
      infrastructure/
      mcp/
    test/
      unit/
      contract/
      e2e/
      fixtures/
      golden/
packages/
  codegen-kernel/
    src/
      common/
      runtime/
      html/
      tailwind/
      flutter/
      swiftui/
      compose/
  codegen-types/
    src/
```

---

## Layer Responsibilities

### `apps/figma-rest-mcp-server/src/core`

Keep stable domain contracts and service-facing abstractions here.

Examples:

- `apps/figma-rest-mcp-server/src/core/contracts.ts`
- `apps/figma-rest-mcp-server/src/core/interfaces.ts`
- `apps/figma-rest-mcp-server/src/core/errors.ts`

### `apps/figma-rest-mcp-server/src/application`

This layer orchestrates the flow and composes domain ports. It should describe the request lifecycle, not raw HTTP or filesystem details.

Examples:

- `apps/figma-rest-mcp-server/src/application/useCases.ts`
- `apps/figma-rest-mcp-server/src/application/factory.ts`
- `apps/figma-rest-mcp-server/src/application/requestContext.ts`

### `apps/figma-rest-mcp-server/src/adapters`

Adapters translate between core/application contracts and external or package-specific implementations.

Examples:

- `apps/figma-rest-mcp-server/src/adapters/figmaRestGateway.ts`
- `apps/figma-rest-mcp-server/src/adapters/generatorAdapter.ts`
- `apps/figma-rest-mcp-server/src/adapters/localAssets/localAssetMaterializer.ts`

### `apps/figma-rest-mcp-server/src/infrastructure`

Infrastructure owns config parsing, HTTP plumbing, metrics, caching, logging, and workspace path mechanics.

Examples:

- `apps/figma-rest-mcp-server/src/infrastructure/config.ts`
- `apps/figma-rest-mcp-server/src/infrastructure/httpClient.ts`
- `apps/figma-rest-mcp-server/src/infrastructure/cache.ts`

### `apps/figma-rest-mcp-server/src/mcp`

This layer should stay thin. It defines schemas, registers tools, and delegates to application use cases.

Examples:

- `apps/figma-rest-mcp-server/src/mcp/server.ts`
- `apps/figma-rest-mcp-server/src/mcp/schemas.ts`
- `apps/figma-rest-mcp-server/src/mcp/convertToolMetadata.ts`

### Shared packages

- Put framework-agnostic exported types in `packages/codegen-types/src/index.ts`.
- Put runtime adapters and framework generators in `packages/codegen-kernel/src/...`.
- Group generator logic by target framework instead of by transport.

Examples:

- `packages/codegen-kernel/src/runtime/runWithSourceSnapshot.ts`
- `packages/codegen-kernel/src/tailwind/tailwindMain.ts`
- `packages/codegen-types/src/index.ts`

---

## Test Layout

Tests are organized by confidence level:

- `test/unit/` for isolated behavior such as schema parsing, helpers, or single adapters
- `test/contract/` for handler/output contracts and golden outputs
- `test/e2e/` for higher-level request flows
- `test/fixtures/` and `test/golden/` for deterministic inputs and expected artifacts

Examples:

- `apps/figma-rest-mcp-server/test/unit/schemas.test.ts`
- `apps/figma-rest-mcp-server/test/contract/frameworkGolden.test.ts`
- `apps/figma-rest-mcp-server/test/e2e/case007.e2e.test.ts`

---

## Naming Conventions

- Use `camelCase.ts` filenames for most source files.
- Use suffixes that reveal the role: `*Adapter.ts`, `*Gateway.ts`, `*UseCase.ts`, `*Builder.ts`, `*Main.ts`.
- Keep exports named. The normal codebase pattern is named exports; the current `export default` usage in `apps/figma-rest-mcp-server/tsup.config.ts` is a toolchain exception.
- Use explicit `.js` import specifiers in TypeScript source because the project is built in `NodeNext` mode.

---

## Placement Rules

- New transport entrypoints belong near `src/cli.ts`, `src/http.ts`, or `src/stdio.ts`, not inside application logic.
- New third-party API calls should go through adapters/infrastructure rather than being embedded in MCP handlers or use cases.
- Shared constants or types should be placed in `core/` or `packages/codegen-types/` before duplicating them across files.
