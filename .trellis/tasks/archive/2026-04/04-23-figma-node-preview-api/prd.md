# brainstorm: 暴露 Figma 节点截图接口

## Goal

新增一个对外暴露的独立截图接口，基于 Figma REST API 按单节点 URL 抓取节点截图，并将截图以 `Preview.png` 的命名写入工作区缓存目录，供调用方后续读取或复用。

## What I already know

* 当前公开 MCP 工具只有 `figma_to_code_convert` 和 `figma_to_code_convert_help`
* 现有服务已经具备 `figmaUrl` 解析能力，要求 URL 必须包含 `node-id`
* 现有服务已经具备 Figma REST 网关、HTTP 客户端、token provider、workspace cache 路径解析能力
* 当前缓存目录约定包括：
* `.figma-to-code/cache/rest/`
* `.figma-to-code/cache/generated/`
* `.figma-to-code/cache/assets/`
* 现有 `WorkspaceRestCacheStore` 只处理 JSON 缓存，不处理 PNG 二进制
* 当前 convert 响应 schema 中虽保留 `preview` 字段，但实现默认关闭，且该 preview 是 HTML 预览，不属于本任务范围

## Assumptions (temporary)

* 新能力应复用现有 `figmaUrl` 解析和 Figma 鉴权链路
* 输出文件应落在 `workspaceRoot` 下的缓存目录，而不是仓库外的全局临时目录
* 文件命名固定包含 `Preview.png`
* 该能力应支持 `useCache`，避免重复请求 Figma 截图接口
* 新工具在命名、schema、contracts 与实现上都必须与现有 HTML preview 概念隔离

## Open Questions

* 无

## Requirements (evolving)

* 输入为带 `node-id` 的 Figma URL
* 对外暴露形式为独立工具，不扩展 `figma_to_code_convert`
* 服务端通过 Figma REST API 获取目标节点截图
* 将截图写入缓存目录
* 输出中包含可供调用方使用的 `Preview.png` 路径
* 新工具及其内部 contracts 不得复用现有 HTML preview artifact 语义
* 失败时复用现有错误风格，返回明确的校验/鉴权/资源不存在错误

## Acceptance Criteria (evolving)

* [ ] 调用时传入合法 `figmaUrl` 可在缓存目录生成节点截图文件
* [ ] 生成文件名为 `Preview.png` 或稳定包含该名称
* [ ] 返回结果包含截图缓存路径
* [ ] 代码中不存在把该功能建模为 HTML preview / preview artifact 的混用
* [ ] 缺失 `node-id` 或 file key 时请求被 schema / resolver 拒绝
* [ ] 至少有单元测试覆盖 schema、路径写入和 Figma 网关截图抓取逻辑

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 批量节点截图
* 自定义截图格式或缩放参数
* 将截图直接内联进 `figma_to_code_convert` 现有代码生成响应中作为 Base64
* 复用、扩展或改造现有 preview HTML 生成链路
* 重做现有 preview HTML 生成功能

## Technical Notes

* 已检查文件：
* `apps/figma-rest-mcp-server/src/mcp/server.ts`
* `apps/figma-rest-mcp-server/src/mcp/schemas.ts`
* `apps/figma-rest-mcp-server/src/adapters/sourceResolver.ts`
* `apps/figma-rest-mcp-server/src/adapters/figmaRestGateway.ts`
* `apps/figma-rest-mcp-server/src/infrastructure/workspacePaths.ts`
* `apps/figma-rest-mcp-server/src/infrastructure/restCacheStore.ts`
* `apps/figma-rest-mcp-server/src/application/factory.ts`
* 现有 `SourceGateway` 尚无截图抓取接口，需要扩展契约
* 二进制 PNG 缓存放在独立目录 `.figma-to-code/cache/screenshot/<fileKey>/<nodeId>/Preview.png`，避免与本地资源缓存混用
* 当前任务中的“Preview.png”仅是输出文件名，不表示 `PreviewArtifact` 或 HTML preview
