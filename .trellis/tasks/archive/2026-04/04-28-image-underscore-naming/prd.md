# brainstorm: 图片文件下划线命名

## Goal

将本地下载图片相关产物命名调整为全小写字母加下划线风格，使生成的缓存文件名和目录 slug 更符合用户期望。

## What I already know

* 用户要求“把 - 改成下划线命名”。
* 用户进一步明确使用“全小写字母加下划线”的命名方式。
* 当前图片资源文件名形如 `figma-image-{imageRef}.{ext}`。
* 当前截图缓存路径中节点 id slug 也使用 `-`，例如 `1:2` 转为 `1-2`。
* 当前相关实现位于 `apps/figma-rest-mcp-server/src/adapters/localAssets/figmaWorkflow.ts`、`figmaScriptCommon.ts` 和 `fileScreenshotArtifactWriter.ts`。

## Assumptions (temporary)

* 需求覆盖下载图片相关命名，包括普通本地图片资源、相关 JSON manifest 文件名、节点 id slug 中的分隔符。
* Figma 原始 `imageRef` 可能包含大写或其他非下划线字符，输出文件名中应转换为小写下划线风格；manifest 内记录的原始 `imageRef` 不改变。

## Open Questions

* 无阻塞问题。

## Requirements (evolving)

* 本地下载图片资源文件名使用小写下划线：`figma_image_{sanitized_image_ref}.{ext}`。
* 图片相关 JSON 产物文件名使用小写下划线。
* 节点 id slug 从 `1-2` 调整为 `1_2`。
* 更新受影响测试断言。

## Acceptance Criteria (evolving)

* [x] 普通图片下载路径断言更新为下划线命名。
* [x] 截图缓存路径断言更新为下划线节点 slug。
* [x] 相关单元测试通过。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Typecheck / test / build considered and run where practical.
* Docs/notes updated if behavior changes.
* Rollback considered if risky.

## Out of Scope

* 不改变下载流程、缓存策略、content-type 扩展名映射。
* 不改变 Figma API 请求字段。

## Technical Notes

* `nodeIdToSlug` 当前只做 `:` -> `-`，应改为 `:` -> `_`。
* 需要新增或复用一个小写下划线文件名 slug 工具，用于 `imageRef` 等可变文件名片段。
* `figmaWorkflow.ts` 中图片、向量、变量 manifest 文件名大量使用 `figma-...` 前缀；按用户要求统一产物命名中的连字符为下划线。
* 截图文件名 `Preview.png` 本身不含连字符，保持不变。
