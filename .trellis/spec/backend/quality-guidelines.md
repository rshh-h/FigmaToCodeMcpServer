# Quality Guidelines

> Quality expectations for backend and MCP service changes.

---

## Required Checks

Repository-level scripts are the quality gate:

```bash
pnpm type-check
pnpm test
pnpm build
```

Current reality:

- `type-check` is currently implemented as `tsc --noEmit`
- tests use Vitest across packages and the app
- `build` validates package buildability and DTS generation across the workspace

See:

- `package.json`
- `apps/figma-rest-mcp-server/package.json`
- `packages/codegen-types/package.json`

---

## Testing Strategy

Choose the cheapest layer that proves the behavior, then add stronger coverage when the risk crosses boundaries.

Current patterns:

- Unit tests for isolated helpers and schemas
  - `apps/figma-rest-mcp-server/test/unit/schemas.test.ts`
  - `apps/figma-rest-mcp-server/test/unit/useCase.test.ts`
- Contract tests for MCP handler behavior and generated outputs
  - `apps/figma-rest-mcp-server/test/contract/mcpHandlers.test.ts`
  - `apps/figma-rest-mcp-server/test/contract/frameworkGolden.test.ts`
- E2E tests for broader request flows
  - `apps/figma-rest-mcp-server/test/e2e/case007.e2e.test.ts`

When a change affects generated output, update or add the corresponding fixture/golden coverage.

---

## Required Patterns

- Keep transport handlers thin and push business flow into use cases.
- Reuse existing contracts and helpers before adding new constants or utility functions.
- Add package-appropriate tests for new behavior, especially schema, error, cache, and output changes.
- Preserve deterministic fixtures and golden outputs.
- Keep NodeNext-compatible `.js` import specifiers in TypeScript source.
- Before making a non-trivial change, align with the user on the intended solution and major tradeoffs.
- If a solution is degraded, partial, or constrained by known blockers, say so explicitly in the completion message.
- Consider whether request parameters, environment variables, and built-in defaults change the final output before declaring the fix correct.
- Prefer fixing the real path while preserving existing behavior instead of bypassing the issue with a fallback-only solution.

---

## Forbidden Patterns

- Silent error swallowing without turning it into a typed service decision or warning
- Direct `fetch` calls outside shared HTTP/client abstractions
- New mutable singletons in the service layer
- Copy-pasting framework-specific branching when an existing builder/helper already owns that concern
- Unbounded retries, caches, or filesystem writes
- Declaring work complete while known implementation gaps still remain
- Hiding downgraded behavior or omitted scope in the final report
- Ignoring parameter/config impacts and validating only one happy-path combination

---

## Review Checklist

- Is the code placed in the correct layer?
- Does new input cross a schema or contract boundary safely?
- Are errors converted into `ServiceError` or another explicit backend contract?
- Is mutable state request-scoped, bounded, or clearly justified?
- Do `type-check`, `test`, and `build` pass?
- Did the solution reduce complexity, or did it add more one-off branching than necessary?
- Did the change reuse existing shared logic instead of introducing a fragmented implementation?
- Were parameter and configuration impacts checked for the final output?
- If the delivered result is partial or degraded, was that stated clearly?
