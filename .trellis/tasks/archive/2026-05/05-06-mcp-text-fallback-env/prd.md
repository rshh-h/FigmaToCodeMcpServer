# Add MCP text fallback env control

## Goal

Add an environment-variable-controlled compatibility mode for MCP clients such as Trae that do not expose `structuredContent`, so tool results can include the same key data in `content[0].text` when explicitly enabled.

## What I already know

* The current `figma_to_code_convert_help` text response is only a short summary, while the full help payload is returned through `structuredContent`.
* Trae appears not to expose `structuredContent`, so users only see the short text summary.
* `figma_to_code_convert` and `figma_to_code_fetch_screenshot` use the same result shape, with a short text summary plus `structuredContent`.
* Existing service configuration is parsed in `apps/figma-rest-mcp-server/src/infrastructure/config.ts` through boolean environment variables.

## Assumptions

* The new environment variable should be opt-in so default behavior remains compatible with existing clients.
* The compatibility mode should not remove `structuredContent`; it should only enrich `content[0].text`.
* The text fallback should be deterministic and concise enough for MCP clients while containing the fields needed to invoke follow-up calls.

## Requirements

* Add a boolean environment variable to control rich text fallback for MCP tool responses.
* When disabled, keep existing concise text summaries.
* When enabled, include key structured result data in the text response for:
  * `figma_to_code_convert_help`
  * `figma_to_code_convert`
  * `figma_to_code_fetch_screenshot`
  * tool error results
* Preserve existing `structuredContent` output for clients that support it.
* Document the new environment variable in README.
* Ensure MCP `tools/list` exposes parameter fields for tools whose full validation schema uses `superRefine`.
* Keep `figma_to_code_convert_help`, but describe it as optional supplemental guidance rather than a required pre-call step.

## Acceptance Criteria

* [x] Default config keeps the new option disabled.
* [x] `figma_to_code_convert_help` includes request example, fields, generation modes, and notes in text when enabled.
* [x] `figma_to_code_convert` includes code path, warnings, preview, and diagnostics summary in text when enabled.
* [x] `figma_to_code_fetch_screenshot` includes screenshot path, file key, and node id in text when enabled.
* [x] Contract/unit tests cover disabled and enabled behavior.
* [x] Type-check and tests pass.
* [x] `tools/list` exposes `figmaUrl`, `workspaceRoot`, `useCache`, `framework`, and `generationMode` for `figma_to_code_convert`.
* [x] `tools/list` exposes `figmaUrl`, `workspaceRoot`, and `useCache` for `figma_to_code_fetch_screenshot`.
* [x] Handler-level validation still rejects invalid Figma URLs and mismatched generation modes.
* [x] `figma_to_code_convert` description presents help as optional guidance.

## Version Plan

* Version impact: patch because this is an opt-in compatibility fix that preserves default behavior.
* If version changes, update both `apps/figma-rest-mcp-server/package.json` and `apps/figma-rest-mcp-server/src/product.ts`.

## Definition of Done

* Tests added or updated.
* Type-check and relevant tests pass.
* Version bump applied consistently.
* README documents the new environment variable and intended Trae compatibility usage.

## Technical Approach

Add a parsed boolean config option, pass the config into MCP handler creation, and centralize text rendering helpers inside the MCP layer. Use concise pretty JSON or sectioned text for fallback data rather than changing the structured schema.

## Decision (ADR-lite)

**Context**: Some MCP clients do not surface `structuredContent`, but this server currently relies on it for full tool results.

**Decision**: Add an opt-in rich text fallback controlled by environment variable while retaining `structuredContent` unchanged.

**Consequences**: Trae users can enable compatibility without changing API shape. Text responses become longer only when explicitly requested.

## Out of Scope

* Detecting Trae automatically.
* Removing or replacing `structuredContent`.
* Changing the convert request or response schemas.

## Technical Notes

* Relevant files inspected:
  * `apps/figma-rest-mcp-server/src/mcp/server.ts`
  * `apps/figma-rest-mcp-server/src/mcp/convertToolMetadata.ts`
  * `apps/figma-rest-mcp-server/src/mcp/schemas.ts`
  * `apps/figma-rest-mcp-server/src/infrastructure/config.ts`
  * `apps/figma-rest-mcp-server/test/contract/mcpHandlers.test.ts`
* Follow-up finding: MCP SDK cannot expose fields from Zod v3 `ZodEffects` schemas produced by `z.object(...).superRefine(...)`; `tools/list` falls back to an empty object schema.
