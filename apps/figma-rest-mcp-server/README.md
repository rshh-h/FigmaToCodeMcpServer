# Anchor D2C MCP

[中文](#chinese) | [English](#english)

当前 CLI 版本 / Current CLI Version: `1.0.2`

<a id="chinese"></a>

## 中文

`anchor-d2c-mcp` 是一个通过 Figma REST API 将单个 Figma 节点转换为前端代码的 MCP 服务。它提供统一的 CLI 入口，支持本地 `stdio` 模式、HTTP 服务模式，以及面向 MCP 客户端的初始化命令。

### 简介

Anchor D2C MCP 的目标是让 Figma to Code 能以更产品化的方式接入 MCP 客户端。

当前支持生成以下目标代码，目前仅 `Tailwind` 经过验证，其他目标尚未经过完整测试验证，使用时请谨慎评估：

- `HTML`
- `Tailwind`
- `Flutter`
- `SwiftUI`
- `Compose`

| `framework` | 合法 `generationMode` |
|---|---|
| `HTML` | `html`, `jsx`, `styled-components`, `svelte` |
| `Tailwind` | `html`, `jsx`, `twig` |
| `Flutter` | `fullApp`, `stateless`, `snippet` |
| `SwiftUI` | `preview`, `struct`, `snippet` |
| `Compose` | `snippet`, `composable`, `screen` |

### 特性

- 提供统一 CLI 入口，支持 `init`、`stdio`、`http`、`help` 和 `version` 命令
- 支持为 `Codex`、`Claude`、`OpenCode` 生成或安装 MCP 配置
- 基于 Figma REST API，将单个节点链接转换为目标代码
- 支持通过环境变量控制 diagnostics、图片嵌入、矢量嵌入和 Tailwind rounding 行为
- 同时支持适配 MCP 客户端的本地 `stdio` 模式和服务化部署的 HTTP 模式

### 安装

使用 `pnpm` 全局安装：

```bash
pnpm install -g anchor-d2c-mcp
```

### 使用方法

#### 可用命令

```bash
anchor-d2c-mcp init codex
anchor-d2c-mcp init claude
anchor-d2c-mcp init opencode
anchor-d2c-mcp stdio
anchor-d2c-mcp http
anchor-d2c-mcp help
anchor-d2c-mcp --version
```

#### 初始化 MCP 客户端

执行 `anchor-d2c-mcp init <target>` 时，CLI 会提示输入 `FIGMA_ACCESS_TOKEN`，然后为对应客户端写入或安装配置。直接回车跳过输入 token，也会继续写入配置，对应字段会保留为空，后续需要你自行打开配置文件补上。

支持的目标包括：

- `codex`：写入 `~/.codex/config.toml`
- `claude`：通过 `claude mcp add --scope user` 安装，并写入 `~/.claude.json`
- `opencode`：写入 `~/.config/opencode/opencode.json`

#### 转码方法

```text
https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427
将这个 figma 设计转换为 Tailwind jsx 风格的代码
```

#### 截图工具用法

当你需要单个 Figma 节点的渲染截图时，使用 `figma_to_code_fetch_screenshot`。这个工具会导出节点截图，并保存到工作区缓存里。

示例提示词：

```text
抓取这个 Figma 节点的截图，并保存到工作区缓存：
https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427
```

### 环境变量

必填项：

- `FIGMA_ACCESS_TOKEN`

常用可选项：

- `INCLUDE_DIAGNOSTICS=false`
- `ENABLE_IMAGE_EMBED=true`
- `ENABLE_VECTOR_EMBED=true`
- `ROUND_TAILWIND_VALUES=false`
- `ROUND_TAILWIND_COLORS=false`

### MCP 配置示例

```toml
[mcp_servers.anchor_d2c_mcp]
type = "stdio"
command = "anchor-d2c-mcp"
args = ["stdio"]
tool_timeout_sec = 600

[mcp_servers.anchor_d2c_mcp.env]
FIGMA_ACCESS_TOKEN = "your figma token"
ENABLE_IMAGE_EMBED = "true"
ENABLE_VECTOR_EMBED = "true"
ROUND_TAILWIND_VALUES = "false"
ROUND_TAILWIND_COLORS = "false"
```

### 许可证

本包使用 `GPL-3.0` 许可证发布。

<a id="english"></a>

## English

`anchor-d2c-mcp` is an MCP server that converts a single Figma node into frontend code through the Figma REST API. It provides a unified CLI for local `stdio` usage, HTTP service mode, and MCP client bootstrap commands.

### Introduction

Anchor D2C MCP is designed to make Figma-to-code adoption more productized for MCP clients.

The server currently supports the following output targets. At the moment, only `Tailwind` has been verified. The other targets have not been fully validated yet, so use them with care:

- `HTML`
- `Tailwind`
- `Flutter`
- `SwiftUI`
- `Compose`

| `framework` | Supported `generationMode` values |
|---|---|
| `HTML` | `html`, `jsx`, `styled-components`, `svelte` |
| `Tailwind` | `html`, `jsx`, `twig` |
| `Flutter` | `fullApp`, `stateless`, `snippet` |
| `SwiftUI` | `preview`, `struct`, `snippet` |
| `Compose` | `snippet`, `composable`, `screen` |

### Features

- Unified CLI entrypoint with `init`, `stdio`, `http`, `help`, and `version` commands
- Bootstrap support for `Codex`, `Claude`, and `OpenCode`
- Converts a single Figma node URL into target code through the Figma REST API
- Supports environment-variable based control over diagnostics, image embedding, vector embedding, and Tailwind rounding behavior
- Supports both local `stdio` mode for MCP clients and HTTP mode for service-style deployment

### Installation

Install globally with `pnpm`:

```bash
pnpm install -g anchor-d2c-mcp
```

### Usage

#### Available Commands

```bash
anchor-d2c-mcp init codex
anchor-d2c-mcp init claude
anchor-d2c-mcp init opencode
anchor-d2c-mcp stdio
anchor-d2c-mcp http
anchor-d2c-mcp help
anchor-d2c-mcp --version
```

#### Initialize an MCP Client

When you run `anchor-d2c-mcp init <target>`, the CLI prompts for `FIGMA_ACCESS_TOKEN`, then writes or installs the matching MCP configuration. If you press Enter without a token, the configuration is still written, but the token field remains empty and should be filled in manually later.

Supported targets:

- `codex`: writes to `~/.codex/config.toml`
- `claude`: installs through `claude mcp add --scope user` and stores configuration in `~/.claude.json`
- `opencode`: writes to `~/.config/opencode/opencode.json`

#### Conversion Prompt Example

```text
https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427
Convert this Figma design into Tailwind JSX code.
```

#### Screenshot Tool Usage

Use `figma_to_code_fetch_screenshot` when you need the rendered screenshot for a single Figma node. The tool exports the node image and stores it in the workspace cache.

Prompt example:

```text
Fetch the screenshot for this Figma node and save it to the workspace cache:
https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427
```

### Environment Variables

Required:

- `FIGMA_ACCESS_TOKEN`

Common optional settings:

- `INCLUDE_DIAGNOSTICS=false`
- `ENABLE_IMAGE_EMBED=true`
- `ENABLE_VECTOR_EMBED=true`
- `ROUND_TAILWIND_VALUES=false`
- `ROUND_TAILWIND_COLORS=false`

### Example MCP Configuration

```toml
[mcp_servers.anchor_d2c_mcp]
type = "stdio"
command = "anchor-d2c-mcp"
args = ["stdio"]
tool_timeout_sec = 600

[mcp_servers.anchor_d2c_mcp.env]
FIGMA_ACCESS_TOKEN = "your figma token"
ENABLE_IMAGE_EMBED = "true"
ENABLE_VECTOR_EMBED = "true"
ROUND_TAILWIND_VALUES = "false"
ROUND_TAILWIND_COLORS = "false"
```

### License

This package is distributed under the `GPL-3.0` license.
