# 本地资源能力说明

本文介绍服务中的本地资源处理能力，包括图片与 SVG 的下载、落盘和代码引用方式。

## 能力目标

在保持主转换链路不变的前提下，服务可以把节点依赖的图片和 SVG 资源保存到本地缓存目录，并让生成结果优先引用这些本地文件。

适用场景：

- 需要离线查看生成结果
- 需要把图片与 SVG 作为工程资产一起保存
- 需要在代码中使用稳定的本地相对路径

## 对应参数

在 `figma_to_code_convert` 的 `options` 中可使用：

- `downloadImagesToLocal`
- `downloadVectorsToLocal`

语义如下：

- 不传或传 `false`：沿用远程资源引用方式
- 传 `true`：下载对应资源并在生成结果中引用本地路径

## 能力落点

本地资源处理位于 `fetch_snapshot` 阶段内部，由适配层完成。

这样可以保证：

- MCP 工具接口保持简洁
- `codegen-kernel` 不需要感知下载过程
- snapshot 在进入标准化与生成阶段前已经具备稳定资源映射

## 资源目录

本地资源统一保存到工作区缓存目录，例如：

- `.figma-to-code/cache/assets/`

目录中通常会包含：

- 下载后的图片文件
- 下载后的 SVG 文件
- 图片与向量资源映射 JSON
- source node 与变量相关的中间数据

## 图片处理

启用 `downloadImagesToLocal` 后，服务会：

1. 从节点快照中收集 `imageRef`
2. 读取 Figma 文件级图片映射
3. 下载图片到本地缓存目录
4. 在 snapshot 中记录 `imageRef -> local path`
5. 在生成代码时优先使用本地路径

## SVG 处理

启用 `downloadVectorsToLocal` 后，服务会：

1. 分析可导出的 vector root
2. 以 root 节点为单位导出 SVG
3. 下载并保存本地 SVG 文件
4. 在 snapshot 中记录 `vector root -> local path`
5. 在生成代码时以本地 SVG 资源替换对应节点

这种方式可以减少重复导出，并与现有向量替换策略保持一致。

## 对生成代码的影响

### HTML / Tailwind

- 图片会使用本地相对路径作为 `src` 或 `background-image`
- SVG 会引用本地文件路径，而不是远程地址

### Flutter / SwiftUI / Compose

- 图片会映射到各平台的本地资源引用方式
- SVG 会尽量映射到平台可表达的本地资源引用形式
- 无法完整表达时，服务会保留 warning

## 与其他能力的关系

本地资源能力与以下输出配合使用最常见：

- `preview`
- `diagnostics`
- `warnings`

当资源下载成功时，生成结果更适合在本地工程中复用；当某类资源无法完全表达时，对应 warning 会帮助调用方理解降级原因。
