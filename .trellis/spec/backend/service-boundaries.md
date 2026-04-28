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

### Convention: Workspace Artifact Naming

**What**: Generated workspace artifact filenames should use lowercase snake_case. Convert generated name segments through the shared local-asset slug helper instead of hand-building mixed-case or dash-separated names.

**Why**: Local image/vector/screenshot paths are returned to callers and embedded into generated code. A single naming convention prevents drift between disk artifacts, manifests, cache reads, and generated framework output.

**Examples**:

- Local image: `.figma-to-code/cache/assets/<fileKey>/1_2/figma_image_hero_ref.png`
- Local vector: `.figma-to-code/cache/assets/<fileKey>/1_2/figma_vector_root_2_1.svg`
- Screenshot: `.figma-to-code/cache/screenshot/<fileKey>/1_2/preview.png`

Keep source identifiers such as the `fileKey` directory and manifest payload fields unchanged unless the source contract itself changes.

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

## Scenario: Standalone Figma Node Screenshot Tool

### 1. Scope / Trigger

- Trigger: 新增公开 MCP tool `figma_to_code_fetch_screenshot`
- 原因: 这是新的跨层接口签名，贯穿 transport schema、application use case、Figma REST gateway 与 workspace cache 写入

### 2. Signatures

- MCP tool: `figma_to_code_fetch_screenshot`
- Request:
  - `figmaUrl: string`
  - `workspaceRoot: string`
  - `useCache?: boolean`
- Response:
  - `screenshotPath: string`
  - `fileKey: string`
  - `nodeId: string`

### 3. Contracts

- 输入 `figmaUrl` 必须是单节点 Figma URL，并包含 `node-id`
- `workspaceRoot` 是截图缓存根目录；输出文件写入该目录下的 workspace cache
- `useCache=true` 时，优先复用现有截图文件
- 返回的 `screenshotPath` 必须是相对 `workspaceRoot` 的路径
- 截图文件固定落在 `.figma-to-code/cache/screenshot/<fileKey>/<node_slug>/preview.png`
- 该 tool 只表示 Figma REST 导出的截图文件，不能复用 HTML preview artifact 语义

### 4. Validation & Error Matrix

- `figmaUrl` 缺失 file key -> `invalid_figma_url`
- `figmaUrl` 缺失 `node-id` -> `missing_source_node_id`
- Figma 导出接口未返回目标节点截图 URL -> `figma_screenshot_not_found`
- 下载内容不是 PNG -> `figma_screenshot_invalid_content_type`
- 其他未归类异常 -> transport 层统一映射为 `unhandled_fetch_screenshot_error`

### 5. Good/Base/Bad Cases

- Good: 合法单节点 URL，首次请求下载 PNG，并返回 `.figma-to-code/cache/screenshot/FILE/1_2/preview.png`
- Base: `useCache=true` 且目标文件已存在，直接返回已有路径，不再次请求 Figma
- Bad: 把该工具的输出挂到 `ConvertResponse.preview` 或复用 `PreviewArtifact`

### 6. Tests Required

- Schema unit test:
  - 合法 `figmaUrl` 可通过
  - 缺失 `node-id` 时拒绝
  - `useCache` 默认值为 `false`
- Gateway unit test:
  - 调用 `/v1/images/<fileKey>` 且 `format=png`
  - 使用 signed URL 下载二进制 PNG
- Writer unit test:
  - 文件写入 `.figma-to-code/cache/screenshot/<fileKey>/<node_slug>/preview.png`
  - 返回相对 `workspaceRoot` 路径
- MCP handler contract test:
  - 返回 `screenshotPath/fileKey/nodeId`
  - 文本响应描述截图缓存结果

### 7. Wrong vs Correct

#### Wrong

- 在 `figma_to_code_convert` 里追加一个 `previewPath`
- 或把截图文件塞进 `PreviewArtifact.html`

#### Correct

- 新增独立 tool `figma_to_code_fetch_screenshot`
- 在独立 use case 中解析 URL、命中/写入缓存、返回截图路径
- 仅复用 `SourceResolver`、`SourceGateway`、workspace cache 能力，不复用 HTML preview 链路
