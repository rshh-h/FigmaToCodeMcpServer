# brainstorm: PRD 增加版本号要求

## Goal

让 Trellis 流程在每次创建 PRD 时明确记录版本号处理要求：根据修改内容范围决定版本号升级级别，并同步更新发布包版本声明的两个位置。

## What I already know

* 用户要求“把修改这两个地方的版本号加入到 trellis 流程里”。
* 需要每次写 `prd.md` 都加一条版本号要求。
* 当前发布版本需要同步的两个位置是 `apps/figma-rest-mcp-server/package.json` 和 `apps/figma-rest-mcp-server/src/product.ts`。
* 版本号升级应根据修改内容范围大小决定。

## Assumptions

* 版本升级规则采用语义化版本：破坏性改动升 major，向后兼容功能升 minor，修复/小范围行为调整升 patch。
* 该要求应进入 Trellis brainstorm PRD 模板，并在 workflow 说明中留下执行规则。

## Open Questions

* 无阻塞问题。

## Requirements

* PRD 模板必须包含版本号处理条目。
* 条目必须明确同步更新 `apps/figma-rest-mcp-server/package.json` 与 `apps/figma-rest-mcp-server/src/product.ts`。
* 条目必须明确按改动范围决定 major/minor/patch。
* 流程文档应说明 Phase 1 写 PRD 时需要包含版本号计划，Phase 2/3 执行和检查时需要落实。

## Acceptance Criteria

* [x] 新建 PRD 模板里包含版本号要求。
* [x] Trellis workflow 文档包含版本号执行规则。
* [x] 检查流程能提醒验证两个版本位置一致。

## Version Plan

* Version impact: none because this task only changes Trellis workflow/skill guidance and does not change the published MCP package runtime behavior.
* If version changes, update both `apps/figma-rest-mcp-server/package.json` and `apps/figma-rest-mcp-server/src/product.ts`.

## Definition of Done

* 相关 Trellis 文档/技能文件已更新。
* 不改业务代码。
* 变更易于未来 AI 在写 PRD 时自动执行。

## Out of Scope

* 不自动计算或写入版本号。
* 不修改 npm 发布脚本。
