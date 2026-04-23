# Figma REST MCP 模块说明

本文介绍当前服务中的主要模块、职责边界以及它们之间的协作关系，帮助阅读者快速了解代码组织方式。

## 模块划分

服务主要由以下几类模块组成：

- `src/mcp`
- `src/application`
- `src/core`
- `src/adapters`
- `src/infrastructure`

测试与样例数据位于：

- `test/unit`
- `test/contract`
- `test/e2e`
- `test/fixtures`
- `test/golden`

## `src/mcp`

这一层负责 MCP 协议接入，包括：

- 工具注册
- 输入输出 schema
- 标准错误映射
- `structuredContent` 返回格式

当前对外工具集中在：

- `figma_to_code_convert`
- `figma_to_code_fetch_screenshot`
- `figma_to_code_convert_help`

## `src/application`

这一层负责请求编排与响应组装。

典型职责：

- 创建 request context
- 协调 source 解析、快照抓取、标准化与生成
- 控制 diagnostics、warnings 的汇总逻辑，并保留 preview 相关内部扩展点

它是服务链路的调度中心，但不直接处理底层 REST 细节。

## `src/core`

这一层定义核心领域结构与契约，例如：

- 领域模型
- 错误类型
- 警告与降级结构
- timing、diagnostics 与 capability contract

`core` 的目标是为上层编排和下层适配提供稳定边界。

## `src/adapters`

适配层连接外部输入与内部核心模型，主要包括：

- Figma 链接解析
- Figma REST gateway
- source snapshot adapter
- normalization adapter
- generator adapter
- preview adapter（当前未接入公开 `figma_to_code_convert` 响应）
- screenshot artifact writer（独立节点截图缓存输出）
- 本地资源处理能力

这一层把 Figma REST 数据与现有代码生成链路转换为服务内部可消费的形式。

## `src/infrastructure`

基础设施层提供横切能力，包括：

- 配置读取
- HTTP 客户端
- 缓存存储
- 日志与 tracing
- 指标与限流能力

它让上层逻辑不需要直接处理环境变量、请求重试或缓存细节。

## 代码生成相关模块

多端代码生成能力主要位于 `packages/codegen-kernel`，由当前服务通过适配层接入。

这一部分负责：

- 接收标准化后的结构
- 调用各 framework builder
- 输出目标平台代码

共享类型位于 `packages/codegen-types`。

## 测试结构

当前测试按目标分层：

- `unit` 用于验证单模块行为
- `contract` 用于验证工具接口与 golden 输出
- `e2e` 用于验证完整服务链路

这种分层方式可以同时覆盖底层规则、接口稳定性和端到端结果。

## 文档阅读建议

如果你是第一次接触这个仓库，推荐按以下顺序阅读：

1. `README.md`
2. `docs/figma-rest-mcp-tool-architecture.zh-CN.md`
3. `docs/render-semantics-preprocess-plan.zh-CN.md`
4. 本文
5. `docs/local-asset-download-plan.md`

随后再进入 `apps/figma-rest-mcp-server/src` 与 `packages/codegen-kernel/src` 查看实现细节。
