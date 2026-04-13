# Figma REST MCP Server

这个仓库提供一个基于 Figma REST API 的 MCP 服务，用于把单个 Figma 节点转换为 `HTML`、`Tailwind`、`Flutter`、`SwiftUI`、`Compose` 代码，并返回 preview、warnings 与 diagnostics。

项目中的代码生成能力参考并整合了上游项目 [bernaferrari/FigmaToCode](https://github.com/bernaferrari/FigmaToCode)，并在当前仓库中补齐了面向 MCP 服务的输入解析、快照构建、能力探测、预览与诊断输出。

## 已知问题

- `file_variables:read` 相关能力受 Figma 企业版权限限制影响，当前版本暂时没有完成实际功能验证。
- 当前服务通过 Figma API 获取数据，与原始插件版的数据来源和运行环境不同，因此生成代码与原始插件版可能存在差异。当前版本的生成质量不代表原始插件版本的生成质量。

## 工作区结构

当前仓库采用 `pnpm + turbo + TypeScript`，包含 3 个工作区：

- `apps/figma-rest-mcp-server`
- `packages/codegen-types`
- `packages/codegen-kernel`

其中：

- `apps/figma-rest-mcp-server` 负责 MCP 服务、Figma REST 访问、缓存、能力探测与响应组装
- `packages/codegen-kernel` 负责转换核心与多端代码生成
- `packages/codegen-types` 提供共享类型定义

## 核心能力

服务主链路包含以下步骤：

1. 解析 `source.url` 中的 `fileKey` 和 `node-id`
2. 拉取目标节点对应的 Figma REST snapshot
3. 构建稳定的 `SourceSnapshot`
4. 归一化为内部 `NormalizedTree`
5. 调用目标 framework generator 生成代码
6. 按需返回 preview、warnings 和 diagnostics

当前对外提供两个 MCP 工具：

- `figma_to_code_convert`
- `figma_to_code_capabilities`

## `figma_to_code_convert`

示例输入：

```json
{
  "source": {
    "url": "https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427"
  },
  "workspaceRoot": "/absolute/path/to/your/project",
  "useCache": true,
  "framework": "HTML",
  "generationMode": "jsx",
  "options": {
    "embedImages": true,
    "embedVectors": true,
    "downloadImagesToLocal": true,
    "downloadVectorsToLocal": true
  }
}
```

说明：

- `source.url` 必须是单节点 Figma URL，且包含 `node-id`
- `workspaceRoot` 用于保存缓存、中间产物与生成结果
- `useCache` 默认为 `true`
- `generationMode` 放在顶层，避免与 `options` 混用
- `options.downloadImagesToLocal` 和 `options.downloadVectorsToLocal` 仅在需要输出本地资源路径时启用

缓存默认写入：

- `<workspaceRoot>/.figma-to-code/cache/rest/`
- `<workspaceRoot>/.figma-to-code/cache/generated/`
- `<workspaceRoot>/.figma-to-code/cache/assets/`

## `figma_to_code_capabilities`

示例输入：

```json
{
  "framework": "Tailwind"
}
```

输出包含：

- `frameworks[]`
- `features`
- `limits[]`

## 环境变量

核心配置位于 `apps/figma-rest-mcp-server/src/infrastructure/config.ts`。

常用环境变量：

- `FIGMA_ACCESS_TOKEN`
- `FIGMA_API_BASE_URL`
- `HTTP_TIMEOUT_MS`
- `HTTP_RETRY_MAX`
- `HTTP_MAX_CONCURRENCY`
- `CACHE_TTL_MS`
- `IMAGE_CACHE_TTL_MS`
- `VECTOR_CACHE_TTL_MS`
- `VARIABLE_CACHE_TTL_MS`
- `AUTH_CACHE_TTL_MS`
- `CACHE_MAX_ENTRIES`
- `ENABLE_METRICS_LOGGING`
- `ENABLE_VARIABLES`
- `ENABLE_IMAGE_EMBED`
- `ENABLE_VECTOR_EMBED`
- `ENABLE_PREVIEW`

示例：

```bash
export FIGMA_ACCESS_TOKEN=xxxxx
export ENABLE_PREVIEW=true
export ENABLE_VARIABLES=true
```

## 本地运行

安装依赖：

```bash
pnpm install
```

启动 `stdio` 模式：

```bash
pnpm --filter figma-to-code-mcp-server dev
```

mcp 本地配置：

```
[mcp_servers.figma_to_code]
type = "stdio"
command = "pnpm"
args = ["--dir", "path to FigmaToCodeMCPServer/apps/figma-rest-mcp-server", "exec", "tsx", "src/stdio.ts"]

[mcp_servers.figma_to_code.env]
FIGMA_ACCESS_TOKEN = "your figma token"
ENABLE_PREVIEW = "false"
ENABLE_VARIABLES = "true"
ENABLE_IMAGE_EMBED = "true"
ENABLE_VECTOR_EMBED = "true"
```

构建并启动 HTTP 模式：

```bash
pnpm --filter figma-to-code-mcp-server build
node apps/figma-rest-mcp-server/dist/http.js
```

健康检查：

```bash
curl http://127.0.0.1:3101/health
```

## Inspector 调试

`stdio`：

```bash
pnpm --filter figma-to-code-mcp-server build
FIGMA_ACCESS_TOKEN=xxxxx npx @modelcontextprotocol/inspector node apps/figma-rest-mcp-server/dist/stdio.js
```

`Streamable HTTP`：

```bash
pnpm --filter figma-to-code-mcp-server build
FIGMA_ACCESS_TOKEN=xxxxx node apps/figma-rest-mcp-server/dist/http.js
npx @modelcontextprotocol/inspector
```

连接地址：

```text
http://127.0.0.1:3101/mcp
```

## 测试

当前测试覆盖：

- `unit`：基础设施、resolver、gateway、normalizer、preview、use case
- `contract`：MCP handler 合同测试与 framework golden
- `e2e`：基于真实结构 fixture 的 mocked pipeline 回归

运行：

```bash
pnpm type-check
pnpm test
pnpm build
```

如需验证真实 Figma 链路，可以运行：

```bash
FIGMA_ACCESS_TOKEN=xxxxx \
FIGMA_FILE_URL='https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427' \
pnpm --filter figma-to-code-mcp-server verify:real
```

可选：

```bash
FIGMA_VERIFY_FRAMEWORK=Tailwind
```

## 常见错误

- `missing_figma_access_token`：启动或调用前设置 `FIGMA_ACCESS_TOKEN`
- `figma_http_401`：检查 token 是否有效、是否过期或被撤销
- `figma_http_403`：确认 token 所属账号能访问目标 Figma 文件
- `figma_http_404`：检查 `source.url` 中的文件和 `node-id` 是否正确
- `figma_http_429`：降低并发或稍后重试
- `missing_source_node_id`：`source.url` 必须带 `node-id`

## 文档

- [工具架构概览](docs/figma-rest-mcp-tool-architecture.zh-CN.md)
- [模块说明](docs/figma-rest-mcp-module-implementation.zh-CN.md)
- [本地资源能力说明](docs/local-asset-download-plan.md)
