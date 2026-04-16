# 渲染语义预处理方案

本文给出一套面向 `packages/codegen-kernel` 的共享预处理方案，用于在正式生成 HTML / Tailwind / 其他目标代码之前，先为节点树补充稳定的“渲染语义”标记。方案重点解决当前结构拍平、图形合并、mask 作用域和局部坐标语义分散在各 renderer 中判断的问题。

## 背景

当前代码生成链路里，很多与结构相关的判断散落在不同模块中：

- `GROUP` 是否保留 wrapper
- 向量或 icon 子树是否可以 flatten 成单个 SVG
- mask 的边界和作用域是否会因为 group flatten 被破坏
- 某些无视觉贡献的中间层是否应该忽略

这类判断目前大多在 renderer 阶段临时完成，例如：

- Tailwind 的 `tailwindGroup()` 会根据当前节点是否产出样式来决定是否保留 wrapper
- HTML 路径有自己独立的一套 group 处理
- `canBeFlattened` 又负责另一套“图形 flatten”判断

这种设计会带来几个问题：

- 同一结构语义在不同 renderer 中表现不一致
- “是否有样式输出”被误用为“是否需要保留结构层”
- 某些局部修复会和其他优化逻辑冲突，导致回归
- 调试时难以区分问题来自结构判断、图形判断还是 renderer 输出

典型现象包括：

- Figma 中横向排布的标签在 JSX 中变成纵向
- 右侧多个独立图标或图片被错误合并成一个
- mask 的作用域扩散到更大的 group 范围
- 某些透明中间层本应可以拍平，但另一些没有视觉样式的 group 又绝不能删除

## 目标

该方案的目标不是直接重写节点树，而是在共享层统一回答以下问题：

- 这个节点是否必须保留 wrapper
- 这个节点是否承担局部坐标系或子节点分组语义
- 这个节点是否允许参与图形 merge / flatten
- 这个节点是否是 mask 边界
- 这个节点是否只是纯透明中间层

最终让 renderer 只做“消费标记并输出代码”，而不再分别推导结构语义。

## 非目标

本方案第一阶段不做以下事情：

- 不直接在预处理阶段重写 children 或删除节点
- 不一次性重做所有 auto-layout 生成逻辑
- 不在第一阶段统一处理所有 decorative-only 节点
- 不替换现有 `canBeFlattened` 检测逻辑本身

这些能力可以在后续阶段逐步迁移。

## 总体思路

引入一个共享的“渲染语义标注”阶段：

1. 节点树先完成现有的基础标准化
2. 新增 `render semantics` pass，对每个节点打语义标记
3. HTML / Tailwind / 其他 renderer 统一消费这些标记

核心原则：

- 预处理阶段只做分析和标注，不直接改树
- 渲染阶段只负责输出，不重复推导结构语义
- 图形 flatten 和结构 wrapper 保留是两条不同规则，必须分开建模

## 为什么不直接在预处理阶段改树

相比“预处理直接删除 group / 提升 children / 重排节点”，本方案更稳，原因如下：

### 可解释性更强

保留原始树结构后，问题排查时可以明确区分：

- 原始 Figma 结构
- 语义分析结果
- renderer 输出结果

如果预处理阶段直接改树，后续很难知道错误来自哪里。

### 能渐进落地

现有工程已经有较多针对 icon、mask、text、auto-layout 的适配。直接改树会把改动范围放大，增加回归风险。标注式方案可以先接入 `GROUP` wrapper，再逐步扩展到 mask 和 flatten 策略。

### 更适合多 renderer 复用

HTML、Tailwind、未来其他 renderer 可以共享同一份语义标记，而不需要各自复制一套判断逻辑。

### 便于测试

语义分析可以单独做纯单元测试，不依赖最终代码字符串。

## 推荐落点

不建议把这套逻辑只放到 `apps/figma-rest-mcp-server` 的 `NormalizationAdapter` 中，因为插件直跑 `codegen-kernel` 的路径不会经过这层，容易导致插件链路和 MCP 链路再次分叉。

建议把新 pass 放在 `packages/codegen-kernel` 中，作为共享能力：

- 新增：
  - `packages/codegen-kernel/src/common/renderSemantics.ts`
  - `packages/codegen-kernel/src/common/renderSemantics.test.ts`
- 在 renderer 入口前调用：
  - `packages/codegen-kernel/src/tailwind/tailwindMain.ts`
  - `packages/codegen-kernel/src/html/htmlMain.ts`

如果后续希望把这一层再上提到统一入口，也应优先保持代码实现位于 kernel 公共层。

## 与现有链路的关系

当前两条主要链路可以抽象为：

- MCP：`snapshot -> normalize -> generate`
- 插件：`nodesToJSON -> convertToCode`

新增 pass 的目标是位于“基础标准化完成之后、renderer 正式输出之前”，因此不依赖某个上层应用实现，而是由 kernel 公共层托管。

建议的逻辑顺序：

1. 原始 JSON / snapshot 转换为当前节点树
2. 现有基础标准化
3. `annotateRenderSemantics(tree)`
4. HTML / Tailwind renderer 消费标记

## 数据模型

建议给节点补一个统一字段，例如：

```ts
type WrapperReason =
  | "flow-item"
  | "local-coordinate-root"
  | "mask-boundary"
  | "clips-content"
  | "explicit-visual-style"
  | "single-child-transparent-wrapper"
  | "decorative-only";

type MergeStrategy = "allow" | "forbid" | "warn";
type FlattenStrategy = "allow" | "forbid";

type StructuralRole =
  | "flow-item"
  | "local-layout-root"
  | "mask-root"
  | "decorative"
  | "transparent-wrapper"
  | "leaf";

interface RenderSemantics {
  preserveWrapper: boolean;
  preserveWrapperReasons: WrapperReason[];

  structuralRole: StructuralRole;

  mergeStrategy: MergeStrategy;
  flattenStrategy: FlattenStrategy;

  establishesLocalCoordinates: boolean;
  dependsOnChildOffsets: boolean;

  isMaskBoundary: boolean;
  hasMeaningfulChildrenGrouping: boolean;
}
```

建议将该字段放在扩展节点对象上，例如：

```ts
type SemanticNode = SceneNode & {
  renderSemantics?: RenderSemantics;
};
```

## 第一阶段优先接管的三个能力

为了控制改动面，第一阶段只建议接管这三类判断：

1. `preserveWrapper`
2. `flattenStrategy`
3. `isMaskBoundary`

这三项已经能覆盖当前最主要的问题集合。

## `preserveWrapper` 规则

### 核心原则

判断标准不应是“当前节点有没有样式输出”，而应是“去掉这一层是否会改变布局语义”。

### 建议命中规则

满足任一条件时，`preserveWrapper = true`：

- 节点是 auto-layout 父节点中的正常流式子项
- 节点有多个子节点，且这些子节点依赖局部坐标关系
- 节点承担 mask / clip / overflow 的结构边界
- 节点自身有明确视觉属性，例如背景、边框、圆角、透明度、旋转
- 节点被识别为一个有意义的 children grouping root

只有在以下条件全部满足时，才允许 `preserveWrapper = false`：

- 没有自身视觉输出
- 不承担 flow item 语义
- 不承担局部坐标语义
- 不承担 mask 边界
- 子节点提升到父级后不会改变 sibling 关系和布局结果

### 对当前问题的解释

例如“社交标签”场景：

- 当前节点是 `GROUP`
- 有 3 个子节点
- 子节点通过离散的 `x` 值在局部坐标系中横向排列
- 外层容器是 `flex-col`

这说明它虽然没有背景、边框等视觉样式，但显然承担了“局部布局根节点”的职责，因此必须保留 wrapper。

## 如何识别局部坐标语义

建议抽一个共享函数，例如：

```ts
function hasMeaningfulRelativeLayout(node: SceneNode): boolean
```

初版可以采用保守策略，命中任一即认为该节点承担局部坐标语义：

- 子节点数量大于等于 2
- 当前节点本身不是一个可直接用 auto-layout 复述的流式容器
- 子节点在当前节点坐标系下存在显著离散的 `x` 或 `y`
- 若丢失当前节点，子节点会直接落入父级布局流，改变排列结果
- 子节点中包含 overlay / absolute / 普通流式节点混排

这类语义建议同时映射为：

- `establishesLocalCoordinates = true`
- `dependsOnChildOffsets = true`
- `hasMeaningfulChildrenGrouping = true`

## `flattenStrategy` 规则

这条规则只处理“图形 flatten 是否安全”，不处理 wrapper 是否保留。

建议保留当前的 `canBeFlattened` 作为“图形上可能 flatten”的初筛条件，再加一层结构语义约束：

- `canBeFlattened = true` 只表示“图形特征允许考虑 flatten”
- 最终是否真的 flatten，还要看 `renderSemantics.flattenStrategy`

建议规则：

- 如果节点是明确的 icon / vector-only 子树，且不包含多个独立语义单元，`flattenStrategy = allow`
- 如果节点内部存在多个应分别输出的独立块，`flattenStrategy = forbid`
- 如果节点整体像一个图形，但存在不确定占位框或装饰框，后续可扩展为 warning 能力

这样可以避免以下问题：

- 三个独立 icon 被错误合成一个 SVG
- 图表 + 底板 + 图标被整体 flatten，丢失独立结构

## `isMaskBoundary` 规则

mask 相关问题建议也前移到语义层统一建模：

- 当前节点是否是 mask root
- 当前节点所在 group / frame 是否必须保留
- 当前边界之内是否允许拍平

建议规则：

- 如果节点自身是 mask，则 `isMaskBoundary = true`
- 如果某个 group / frame 直接承载 mask 和被 mask 内容的作用域，也应视为边界
- 命中边界的节点默认 `preserveWrapper = true`
- 对包含 mask 语义的 group，应默认禁止因普通 wrapper 优化而拍平

mask 模块继续负责“如何渲染”，但边界判定应尽量交给语义层。

## 与现有模块的衔接方式

### Tailwind

当前 `tailwindGroup()` 主要依据 builder 是否产生 class / style 来决定是否保留 wrapper。建议迁移为：

- 优先读取 `node.renderSemantics.preserveWrapper`
- 若为 `true`，即使当前节点没有额外 class，也输出 wrapper
- 只有 `preserveWrapper = false` 时，才允许直接返回 children

向量 flatten 逻辑建议改为：

- 只有 `canBeFlattened && flattenStrategy === "allow"` 时才 flatten

### HTML

HTML 路径也应和 Tailwind 一样读取同一份语义标记，而不是继续沿用独立的 group 省略逻辑。

### Mask

mask 模块继续负责 render plan，但在做结构重写前应读取：

- `isMaskBoundary`
- `preserveWrapper`

避免因为普通 flatten 逻辑破坏 mask 作用域。

## 函数拆分建议

不要把整个 pass 写成一个超大函数，建议拆成小粒度判断：

```ts
annotateRenderSemantics(rootNodes)
analyzeNodeSemantics(node, parent)
shouldPreserveWrapper(node)
hasMeaningfulRelativeLayout(node)
resolveFlattenStrategy(node)
resolveMaskBoundary(node)
hasExplicitVisualStyle(node)
```

好处：

- 更容易做针对性测试
- 出问题时更容易定位是哪一条规则错了
- 后续新增 decorative-only、transparent-wrapper 等能力时更容易扩展

## 推荐的实施顺序

### 第一步

新增 `renderSemantics.ts` 与对应测试文件，只实现：

- `preserveWrapper`
- `hasMeaningfulRelativeLayout`
- `isMaskBoundary`

### 第二步

让 `tailwindGroup()` 和 `htmlGroup()` 都读 `preserveWrapper`，统一 `GROUP` wrapper 保留行为。

### 第三步

在 vector flatten 入口增加 `flattenStrategy` 判断。

### 第四步

把 mask 相关的 flatten 守卫迁移为读取 `isMaskBoundary` 和 `preserveWrapper`。

## 测试策略

建议拆成两层测试。

### 单元测试

新增：

- `packages/codegen-kernel/src/common/renderSemantics.test.ts`

至少覆盖：

- `GROUP + 多子节点 + 子节点离散 x` => `preserveWrapper = true`
- `GROUP + 单子节点 + 无视觉语义` => `preserveWrapper = false`
- `mask parent/group` => `isMaskBoundary = true`
- `icon-like vector tree + 多独立块` => `flattenStrategy = forbid`

### 回归测试

建议用现有真实节点回归：

- `3:6382` 社交标签横向
- `8:8546` 三张图不要合并
- `3:1737` / `8:5742` 图表和 actions 图标
- `8:28543` mask 作用域
- `3:4457` auto-layout 流布局

## 方案优点

- 统一结构语义，减少 renderer 层重复判断
- 能把“结构 wrapper 保留”和“图形 flatten”分开建模
- 更容易控制回归范围
- 插件链路和 MCP 链路都能复用
- 更便于做针对性单元测试

## 风险与注意事项

- 如果把这套逻辑只放在 MCP 的 normalizer 中，会导致插件和 MCP 再次分叉
- 如果第一版就试图覆盖所有 decorative-only 或透明占位层，范围会过大
- 如果预处理阶段直接重写树，调试和回归成本会明显增加

因此建议第一阶段坚持：

- 只做标注，不改树
- 先接管 `GROUP` wrapper、flatten 策略和 mask 边界
- 等测试稳定后再逐步扩展

## 总结

本方案的核心不是再补一个局部守卫，而是在共享层引入“渲染语义”这一中间抽象：

- 基础标准化负责把原始 Figma 数据转成稳定节点树
- 渲染语义预处理负责判断节点在结构上的角色
- renderer 负责消费语义并输出代码

这样能把当前 scattered 的结构判断收拢起来，并为后续处理 group flatten、mask、icon merge、decorative-only 节点提供一致的扩展点。
