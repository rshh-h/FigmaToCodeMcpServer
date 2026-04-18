# Anchor D2C MCP

`anchor-d2c-mcp` 是一个基于 Figma REST API 的 MCP 服务，用于把单个 Figma 节点转换为 `HTML`、`Tailwind`、`Flutter`、`SwiftUI`、`Compose` 代码。

项目中的代码生成能力参考 [bernaferrari/FigmaToCode](https://github.com/bernaferrari/FigmaToCode)，并在当前仓库中补齐了面向 MCP 服务的输入解析与诊断输出。

当前服务通过 Figma API 获取数据，同时添加了下载资源文件的能力。与原始插件版的数据来源和运行环境不同，因此生成代码与原始插件版可能存在差异。当前版本的生成质量不代表原始插件版本的生成质量。

## 已知问题

- `file_variables:read` 相关能力受 Figma 企业版权限限制影响，当前版本暂时没有完成实际功能验证。
- 当 figma 中 svg 通过 effets 设置阴影时，导出的 svg 宽高可能和原始不匹配
- 不支持 figma 多层设计，代码会生成到一个层里
- vector mask 不支持，直接按照普通 Rectangle mask 处理
- 修改后只对Tailwind，jsx 类型进行了测试，其他输出格式未验证。

## 安装与启动

推荐通过 pnpm 包安装后，使用统一命令 `anchor-d2c-mcp`：

```bash
pnpm install -g anchor-d2c-mcp
```

可用子命令：

```bash
anchor-d2c-mcp init codex
anchor-d2c-mcp init claude
anchor-d2c-mcp init opencode
anchor-d2c-mcp stdio
anchor-d2c-mcp http
anchor-d2c-mcp help
anchor-d2c-mcp --version
```

`init` 会提示输入 `FIGMA_ACCESS_TOKEN`。如果直接回车，会把空字符串写入配置。写完后 CLI 会提示实际写入的文件位置，你可以再自己打开文件调整。

### 初始化配置

使用 init 命令配置到不同的 cli

Codex：

```bash
anchor-d2c-mcp init codex
```

Claude：

```bash
anchor-d2c-mcp init claude
```

使用 `claude mcp add` 安装，等价于：

```bash
claude mcp add --transport stdio --scope user ... anchor-d2c-mcp -- anchor-d2c-mcp stdio
```

OpenCode：

```bash
anchor-d2c-mcp init opencode
```

如果需要像素级一致，建议关闭 `ROUND_TAILWIND_VALUES` 和 `ROUND_TAILWIND_COLORS`。
通过 Figma REST API 拉取数据可能受网络影响和频率限制，推荐适当增大工具超时时间。

#### 转码方法

```text
https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427
将这个 figma 设计转换为 Tailwind jsx 风格的代码
```

### HTTP 模式

启动 HTTP 模式：

```bash
anchor-d2c-mcp http
```

健康检查：

```bash
curl http://127.0.0.1:3101/health
```

## 工作区结构

当前仓库采用 `pnpm + turbo + TypeScript`，包含 3 个工作区：

- `apps/figma-rest-mcp-server` 负责 MCP 服务、Figma REST 访问、缓存、能力探测与响应组装
- `packages/codegen-kernel` 负责转换核心与多端代码生成
- `packages/codegen-types` 提供共享类型定义

## 核心能力

服务主链路包含以下步骤：

1. 解析 `figmaUrl` 中的 `fileKey` 和 `node-id`
2. 拉取目标节点对应的 Figma REST snapshot
3. 构建稳定的 `SourceSnapshot`
4. 归一化为内部 `NormalizedTree`
5. 调用目标 framework generator 生成代码
6. 返回生成代码路径与 warnings，并按环境变量决定是否返回 diagnostics

当前对外提供两个 MCP 工具：

- `figma_to_code_convert`
- `figma_to_code_convert_help`

## `figma_to_code_convert`

调用前建议先使用 `figma_to_code_convert_help` 获取请求模板和字段说明。

入参表：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `figmaUrl` | `string` | 是 | 无 | 单节点 Figma URL，必须包含 `node-id` |
| `workspaceRoot` | `string` | 是 | 无 | 工作区根目录，用于保存缓存、中间产物与生成结果 |
| `useCache` | `boolean` | 否 | `false` | 是否复用当前工作区下的 REST 缓存和本地资产中间产物 |
| `framework` | `"HTML" \| "Tailwind" \| "Flutter" \| "SwiftUI" \| "Compose"` | 是 | 无 | 目标代码框架 |
| `generationMode` | `string` | 否 | 无 | 对应框架的生成模式，取值受 `framework` 限制 |

`generationMode` 可选值：

| `framework` | 合法 `generationMode` |
|---|---|
| `HTML` | `html`, `jsx`, `styled-components`, `svelte` |
| `Tailwind` | `html`, `jsx`, `twig` |
| `Flutter` | `fullApp`, `stateless`, `snippet` |
| `SwiftUI` | `preview`, `struct`, `snippet` |
| `Compose` | `snippet`, `composable`, `screen` |

说明：

- 本地图片和向量资源默认写入 `<workspaceRoot>/.figma-to-code/cache/assets/`
- 公开 `figma_to_code_convert` 请求当前不暴露 `downloadImagesToLocal` / `downloadVectorsToLocal` 字段；本地资源下载行为由服务端环境变量 `DOWNLOAD_IMAGES_TO_LOCAL` / `DOWNLOAD_VECTORS_TO_LOCAL` 控制
- `preview` 相关内部模块与响应 schema 仍然保留，但当前公开工具固定不生成 `preview`

缓存默认写入：

- `<workspaceRoot>/.figma-to-code/cache/rest/`
- `<workspaceRoot>/.figma-to-code/cache/generated/`
- `<workspaceRoot>/.figma-to-code/cache/assets/`

## `figma_to_code_convert_help`

返回 `figma_to_code_convert` 的：

- 请求样例
- 字段说明
- framework 对应的合法 `generationMode`
- 调用注意事项

## 环境变量

核心配置位于 `apps/figma-rest-mcp-server/src/infrastructure/config.ts`。

环境变量表：

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `FIGMA_ACCESS_TOKEN` | `string` | 是 | 无 | Figma API token，服务启动必需 |
| `FIGMA_API_BASE_URL` | `string` | 否 | `https://api.figma.com` | Figma API 基地址 |
| `HTTP_TIMEOUT_MS` | `number` | 否 | `15000` | HTTP 请求超时毫秒数 |
| `HTTP_RETRY_MAX` | `number` | 否 | `2` | HTTP 最大重试次数 |
| `HTTP_MAX_CONCURRENCY` | `number` | 否 | `6` | HTTP 并发上限 |
| `CACHE_TTL_MS` | `number` | 否 | `300000` | 通用缓存 TTL |
| `IMAGE_CACHE_TTL_MS` | `number` | 否 | 无 | 图片缓存 TTL，未设置时沿用 `CACHE_TTL_MS` |
| `VECTOR_CACHE_TTL_MS` | `number` | 否 | 无 | 向量缓存 TTL，未设置时沿用 `CACHE_TTL_MS` |
| `VARIABLE_CACHE_TTL_MS` | `number` | 否 | 无 | 变量缓存 TTL，未设置时沿用 `CACHE_TTL_MS` |
| `AUTH_CACHE_TTL_MS` | `number` | 否 | 无 | 认证缓存 TTL，未设置时沿用 `CACHE_TTL_MS` |
| `CACHE_MAX_ENTRIES` | `number` | 否 | `500` | 进程内缓存最大条目数 |
| `ENABLE_VARIABLES` | `boolean` | 否 | `false` | 是否启用变量能力，同时也是颜色变量输出的默认来源 |
| `INCLUDE_DIAGNOSTICS` | `boolean` | 否 | `false` | 是否默认在响应中返回 diagnostics |
| `ENABLE_IMAGE_EMBED` | `boolean` | 否 | `true` | 是否启用图片嵌入能力，同时也是图片嵌入输出的默认来源 |
| `ENABLE_VECTOR_EMBED` | `boolean` | 否 | `true` | 是否启用向量嵌入能力，同时也是向量嵌入输出的默认来源 |
| `ENABLE_METRICS_LOGGING` | `boolean` | 否 | `false` | 是否输出 metrics 日志 |
| `SHOW_LAYER_NAMES` | `boolean` | 否 | `false` | 是否在输出中显示 layer 名称 |
| `ROUND_TAILWIND_VALUES` | `boolean` | 否 | `true` | Tailwind 数值是否按阈值近似映射 |
| `ROUND_TAILWIND_COLORS` | `boolean` | 否 | `true` | Tailwind 颜色是否按阈值近似映射 |
| `USE_TAILWIND4` | `boolean` | 否 | `false` | 是否启用 Tailwind 4 相关生成逻辑 |
| `CUSTOM_TAILWIND_PREFIX` | `string` | 否 | `""` | Tailwind 类名前缀 |
| `BASE_FONT_SIZE` | `number` | 否 | `16` | 基础字体大小，用于部分 Tailwind/排版换算 |
| `THRESHOLD_PERCENT` | `number` | 否 | `15` | Tailwind 数值近似匹配阈值百分比 |
| `BASE_FONT_FAMILY` | `string` | 否 | `""` | 默认字体族 |
| `FONT_FAMILY_CUSTOM_CONFIG` | `JSON string` | 否 | `{}` | 自定义字体映射，环境变量中需传 JSON 字符串 |
| `DOWNLOAD_IMAGES_TO_LOCAL` | `boolean` | 否 | `true` | 是否默认下载图片到工作区本地 |
| `DOWNLOAD_VECTORS_TO_LOCAL` | `boolean` | 否 | `true` | 是否默认下载向量到工作区本地 |

示例：

```bash
export FIGMA_ACCESS_TOKEN=xxxxx
export ENABLE_VARIABLES=false
export INCLUDE_DIAGNOSTICS=false
export ENABLE_IMAGE_EMBED=true
export ENABLE_VECTOR_EMBED=true
```

### 开发者运行

```bash
pnpm install
pnpm --filter anchor-d2c-mcp dev
```

构建：

```bash
pnpm --filter anchor-d2c-mcp build
```

## Inspector 调试

`stdio`：

```bash
pnpm --filter anchor-d2c-mcp build
FIGMA_ACCESS_TOKEN=xxxxx npx @modelcontextprotocol/inspector anchor-d2c-mcp stdio
```

`Streamable HTTP`：

```bash
pnpm --filter anchor-d2c-mcp build
FIGMA_ACCESS_TOKEN=xxxxx anchor-d2c-mcp http
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
pnpm --filter anchor-d2c-mcp verify:real
```

## 常见错误

- `missing_figma_access_token`：启动或调用前设置 `FIGMA_ACCESS_TOKEN`
- `figma_http_401`：检查 token 是否有效、是否过期或被撤销
- `figma_http_403`：确认 token 所属账号能访问目标 Figma 文件
- `figma_http_404`：检查 `figmaUrl` 中的文件和 `node-id` 是否正确
- `figma_http_429`：降低并发或稍后重试
- `missing_source_node_id`：`figmaUrl` 必须带 `node-id`

## 文档

- [工具架构概览](docs/figma-rest-mcp-tool-architecture.zh-CN.md)
- [模块说明](docs/figma-rest-mcp-module-implementation.zh-CN.md)
- [渲染语义预处理方案](docs/render-semantics-preprocess-plan.zh-CN.md)
- [本地资源能力说明](docs/local-asset-download-plan.md)
