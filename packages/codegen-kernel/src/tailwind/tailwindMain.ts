import { retrieveTopFill } from "../common/retrieveFill";
import { indentString } from "../common/indentString";
import { addWarning } from "../common/commonConversionWarnings";
import { formatStyleAttribute } from "../common/commonFormatAttributes";
import { getVisibleNodes } from "../common/nodeVisibility";
import { getPlaceholderImage } from "../common/images";
import { buildMaskRenderPlan } from "../common/maskNodes";
import { getImageFillRenderPlan } from "../common/imageFillRender";
import {
  commonIsAbsolutePosition,
  getCommonPositionValue,
} from "../common/commonPosition";
import { TailwindTextBuilder } from "./tailwindTextBuilder";
import { TailwindDefaultBuilder } from "./tailwindDefaultBuilder";
import { tailwindAutoLayoutProps } from "./builderImpl/tailwindAutoLayout";
import {
  getLocalImagePath,
  getLocalVectorPath,
  isLocalVectorChildNode,
  renderAndAttachSVG,
} from "../altNodes/altNodeUtils";
import { numberToFixedString } from "../common/numToAutoFixed";
import { formatWithJSX } from "../common/parseJSX";
import {
  annotateRenderSemantics,
  shouldAllowNodeFlatten,
  shouldAllowNodeMerge,
  shouldPreserveNodeWrapper,
} from "../common/renderSemantics";
import { AltNode, PluginSettings, TailwindSettings } from "../pluginTypes";
import { ImagePaint } from "../api_types";
import { pxToLayoutSize } from "./conversionTables";

export let localTailwindSettings: PluginSettings;
let previousExecutionCache: {
  style: string;
  text: string;
  openTypeFeatures: Record<string, boolean>;
}[] = [];
const SELF_CLOSING_TAGS = ["img"];

const hasNestedImageFillChild = (node: SceneNode): boolean =>
  "children" in node &&
  node.children.some((child) => {
    const childTopFill = "fills" in child ? retrieveTopFill(child.fills) : undefined;
    const childHasImageFill =
      getLocalImagePath(child) !== undefined || childTopFill?.type === "IMAGE";

    return (
      childHasImageFill &&
      Math.abs(child.width - node.width) < 0.5 &&
      Math.abs(child.height - node.height) < 0.5
    );
  });

export const tailwindMain = async (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings,
): Promise<string> => {
  localTailwindSettings = settings;
  previousExecutionCache = [];
  annotateRenderSemantics(sceneNode);

  let result = await tailwindWidgetGenerator(sceneNode, settings);

  // Remove the initial newline that is made in Container
  if (result.startsWith("\n")) {
    result = result.slice(1);
  }

  return result;
};

const tailwindWidgetGenerator = async (
  sceneNode: ReadonlyArray<SceneNode>,
  settings: TailwindSettings,
): Promise<string> => {
  const visibleNodes = getVisibleNodes(sceneNode);
  const renderPlan = buildMaskRenderPlan(visibleNodes);
  const convert = convertNode(settings);
  const promiseOfConvertedCode = renderPlan.map(async (item) => {
    if (item.warning) {
      addWarning(item.warning);
    }

    if (item.kind === "mask-group") {
      return await tailwindStructuralMaskGroup(
        item.maskNode,
        item.maskedNodes,
        settings,
      );
    }

    return await convert(item.node);
  });
  const code = (await Promise.all(promiseOfConvertedCode)).join("");
  return code;
};

const tailwindStructuralMaskGroup = async (
  maskNode: SceneNode,
  maskedNodes: readonly SceneNode[],
  settings: TailwindSettings,
): Promise<string> => {
  const childrenStr = await tailwindWidgetGenerator(maskedNodes, settings);
  const { x, y } = getCommonPositionValue(maskNode, settings);
  const isJSX = settings.tailwindGenerationMode === "jsx";
  const rebasedChildren = wrapMaskChildrenWithOffset(
    childrenStr,
    -x,
    -y,
    maskNode.width,
    maskNode.height,
    isJSX,
  );
  const additionalClasses = [
    "overflow-hidden",
    commonIsAbsolutePosition(maskNode) ? "" : "relative",
  ]
    .filter(Boolean)
    .join(" ");
  const builder = new TailwindDefaultBuilder(maskNode, settings)
    .size()
    .position()
    .blend()
    .radius();

  return `\n<div${builder.build(additionalClasses)}>${indentString(rebasedChildren)}\n</div>`;
};

const wrapMaskChildrenWithOffset = (
  children: string,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  isJSX: boolean,
): string => {
  const attributes = [
    "absolute",
    offsetX === 0 ? "left-0" : `left-[${numberToFixedString(offsetX)}px]`,
    offsetY === 0 ? "top-0" : `top-[${numberToFixedString(offsetY)}px]`,
    formatMaskWrapperSize(width, "w"),
    formatMaskWrapperSize(height, "h"),
  ]
    .filter(Boolean)
    .join(" ");
  const classLabel = isJSX ? "className" : "class";

  return `\n<div ${classLabel}="${attributes}">${indentString(children)}\n</div>`;
};

const formatMaskWrapperSize = (
  value: number,
  prefix: "w" | "h",
): string => {
  const tailwindValue = pxToLayoutSize(value);
  if (!tailwindValue.startsWith("[")) {
    return `${prefix}-${tailwindValue}`;
  }

  const fixed = numberToFixedString(value);
  return fixed === "0" ? `${prefix}-0` : `${prefix}-[${fixed}px]`;
};

const convertNode =
  (settings: TailwindSettings) =>
  async (node: SceneNode): Promise<string> => {
    if (isLocalVectorChildNode(node)) {
      return "";
    }

    const localVectorPath = getLocalVectorPath(node);
    if (localVectorPath) {
      return tailwindWrapSVG(node as AltNode<SceneNode>, settings, localVectorPath);
    }

    if (
      settings.embedVectors &&
      (node as any).canBeFlattened &&
      shouldAllowNodeFlatten(node) &&
      shouldAllowNodeMerge(node)
    ) {
      const altNode = await renderAndAttachSVG(node);
      if (altNode.svg) {
        return tailwindWrapSVG(altNode, settings);
      }
    }

    switch (node.type) {
      case "RECTANGLE":
      case "ELLIPSE":
        return tailwindContainer(node, "", "", settings);
      case "GROUP":
        return tailwindGroup(node, settings);
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
      case "COMPONENT_SET":
        return tailwindFrame(node, settings);
      case "TEXT":
        return tailwindText(node, settings);
      case "LINE":
        return tailwindLine(node, settings);
      case "SECTION":
        return tailwindSection(node, settings);
      case "VECTOR":
        if (!settings.embedVectors) {
          addWarning("Vector is not supported");
        }
        return tailwindContainer(
          { ...node, type: "RECTANGLE" } as any,
          "",
          "",
          settings,
        );
      default:
        addWarning(`${node.type} node is not supported`);
    }
    return "";
  };

const tailwindWrapSVG = (
  node: AltNode<SceneNode>,
  settings: TailwindSettings,
  localVectorPath?: string,
): string => {
  const builder = new TailwindDefaultBuilder(node, settings)
    .addData("svg-wrapper")
    .position();

  if (localVectorPath) {
    return `\n<img${builder.build()} src="${localVectorPath}" />`;
  }

  if (!node.svg) return "";

  return `\n<div${builder.build()}>\n${indentString(node.svg ?? "")}</div>`;
};

const tailwindGroup = async (
  node: GroupNode,
  settings: TailwindSettings,
): Promise<string> => {
  // Ignore the view when size is zero or less or if there are no children
  if (node.width < 0 || node.height <= 0 || node.children.length === 0) {
    return "";
  }

  const preserveWrapper = shouldPreserveNodeWrapper(node);
  const builder = new TailwindDefaultBuilder(node, settings)
    .blend()
    .size()
    .position();
  const forceWidth =
    "layoutSizingHorizontal" in node
      ? node.layoutSizingHorizontal === "HUG"
      : false;
  const forceHeight =
    "layoutSizingVertical" in node ? node.layoutSizingVertical === "HUG" : false;
  const structuralAttributes = preserveWrapper
    ? [
        forceWidth ? `w-[${numberToFixedString(node.width)}px]` : "",
        forceHeight ? `h-[${numberToFixedString(node.height)}px]` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  if (
    preserveWrapper ||
    builder.attributes.length > 0 ||
    builder.styles.length > 0
  ) {
    const attr = builder.build(structuralAttributes);
    const generator = await tailwindWidgetGenerator(node.children, settings);
    return `\n<div${attr}>${indentString(generator)}\n</div>`;
  }

  return await tailwindWidgetGenerator(node.children, settings);
};

export const tailwindText = (
  node: TextNode,
  settings: TailwindSettings,
): string => {
  const layoutBuilder = new TailwindTextBuilder(node, settings)
    .commonPositionStyles()
    .textAlignHorizontal()
    .textAlignVertical();

  if (node.textAutoResize === "WIDTH_AND_HEIGHT") {
    // Preserve Figma's hug-content text behavior and prevent browser line wraps.
    layoutBuilder.addAttributes("w-max", "whitespace-nowrap");
  }

  const styledHtml = layoutBuilder.getTextSegments(node);
  previousExecutionCache.push(...styledHtml);

  let content = "";
  if (styledHtml.length === 1) {
    const segment = styledHtml[0];
    layoutBuilder.addAttributes(segment.style);

    const getFeatureTag = (features: Record<string, boolean>): string => {
      if (features.SUBS === true) return "sub";
      if (features.SUPS === true) return "sup";
      return "";
    };

    const additionalTag = getFeatureTag(segment.openTypeFeatures);
    content = additionalTag
      ? `<${additionalTag}>${segment.text}</${additionalTag}>`
      : segment.text;
  } else {
    content = styledHtml
      .map((style) => {
        const tag =
          style.openTypeFeatures.SUBS === true
            ? "sub"
            : style.openTypeFeatures.SUPS === true
              ? "sup"
              : "span";

        return `<${tag} class="${style.style}">${style.text}</${tag}>`;
      })
      .join("");
  }

  return `\n<div${layoutBuilder.build()}>${content}</div>`;
};

const tailwindFrame = async (
  node: FrameNode | InstanceNode | ComponentNode | ComponentSetNode,
  settings: TailwindSettings,
): Promise<string> => {
  // Check if this is an instance and should be rendered as a Twig component
  if (node.type === "INSTANCE" && isTwigComponentNode(node)) {
    return tailwindTwigComponentInstance(node, settings);
  }

  const childrenStr = await tailwindWidgetGenerator(node.children, settings);

  const clipsContentClass =
    node.clipsContent && "children" in node && node.children.length > 0
      ? "overflow-hidden"
      : "";
  let layoutProps = "";

  if (node.layoutMode !== "NONE") {
    layoutProps = tailwindAutoLayoutProps(node, node);
  }

  // Combine classes properly, ensuring no extra spaces
  const combinedProps = [layoutProps, clipsContentClass]
    .filter(Boolean)
    .join(" ");

  return tailwindContainer(node, childrenStr, combinedProps, settings);
};


// Helper function to generate Twig component syntax for component instances
const tailwindTwigComponentInstance = async (
  node: InstanceNode,
  settings: TailwindSettings,
): Promise<string> => {
  // Extract component name from the instance
  const componentName = extractComponentName(node);

  // Get component properties if needed
  const builder = new TailwindDefaultBuilder(node, settings)
    // .commonPositionStyles()
    // .commonShapeStyles()
  ;

  const attributes = builder.build();

  // If we have children, process them
  let childrenStr = "";

  const embeddableChildren = node.children ? node.children.filter((n) => isTwigContentNode(n)) : [];

  if (embeddableChildren.length > 0) {
    // We keep embedded components and Frame named "TwigContent"
    childrenStr = await tailwindWidgetGenerator(embeddableChildren, settings);
    return `\n<twig:${componentName}${attributes}>${indentString(childrenStr)}\n</twig:${componentName}>`;
  } else {
    // Self-closing tag if no children
    return `\n<twig:${componentName}${attributes} />`;
  }
};

const isTwigComponentNode = (node: SceneNode): boolean => {
  return localTailwindSettings.tailwindGenerationMode === "twig" && node.type === "INSTANCE" && !extractComponentName(node).startsWith("HTML:") && !isTwigContentNode(node);
}

const isTwigContentNode = (node: SceneNode): boolean => {
  return node.type === "INSTANCE" && node.name.startsWith("TwigContent");
}

// Helper function to extract component name from an instance
const extractComponentName = (node: InstanceNode): string => {
  // Try to get name from mainComponent if available
  if (node.mainComponent) {
    return node.mainComponent.name;
  }

  // Fallback to node name if mainComponent is not available
  return node.name;
};

export const tailwindContainer = (
  node: SceneNode &
    SceneNodeMixin &
    BlendMixin &
    LayoutMixin &
    GeometryMixin &
    MinimalBlendMixin,
  children: string,
  additionalAttr: string,
  settings: TailwindSettings,
): string => {
  // Ignore the view when size is zero or less
  if (node.width < 0 || node.height < 0) {
    return children;
  }

  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();
  const topFill = retrieveTopFill(node.fills);
  const hasImageFill = topFill?.type === "IMAGE";

  if (!builder.attributes && !additionalAttr && !hasImageFill) {
    return children;
  }

  // Determine if we should use img tag
  let tag = "div";
  let src = "";
  let renderedChildren = children;

  if (hasImageFill && !hasNestedImageFillChild(node)) {
    const localImagePath = getLocalImagePath(node);
    const imageURL =
      localImagePath ?? getPlaceholderImage(node.width, node.height);
    const renderPlan = getImageFillRenderPlan(
      topFill as ImagePaint,
      children.trim().length > 0,
    );

    if (!localImagePath) {
      addWarning("Image fills are replaced with placeholders");
    }

    if (renderPlan.renderMode === "img") {
      tag = "img";
      src = ` src="${imageURL}"`;
      if (renderPlan.disableMaxWidth) {
        builder.addAttributes("max-w-none");
      }
      if (renderPlan.objectFit) {
        builder.addAttributes(`object-${renderPlan.objectFit}`);
      }
      if (renderPlan.objectPosition === "center") {
        builder.addAttributes("object-center");
      }
    } else {
      builder.addStyles(
        formatWithJSX(
          "background-image",
          settings.tailwindGenerationMode === "jsx",
          `url(\"${imageURL}\")`,
        ),
      );
      if (renderPlan.backgroundSize === "cover") {
        builder.addAttributes("bg-cover");
      } else if (renderPlan.backgroundSize === "contain") {
        builder.addAttributes("bg-contain");
      } else if (renderPlan.backgroundSize) {
        builder.addStyles(
          formatWithJSX(
            "background-size",
            settings.tailwindGenerationMode === "jsx",
            renderPlan.backgroundSize,
          ),
        );
      }
      if (renderPlan.backgroundPosition === "center") {
        builder.addAttributes("bg-center");
      } else if (renderPlan.backgroundPosition) {
        builder.addStyles(
          formatWithJSX(
            "background-position",
            settings.tailwindGenerationMode === "jsx",
            renderPlan.backgroundPosition,
          ),
        );
      }
      if (renderPlan.backgroundRepeat === "repeat") {
        builder.addAttributes("bg-repeat");
      } else if (renderPlan.backgroundRepeat === "no-repeat") {
        builder.addAttributes("bg-no-repeat");
      }
    }
  }

  const build = builder.build(additionalAttr);

  // Generate appropriate HTML
  if (renderedChildren) {
    return `\n<${tag}${build}${src}>${indentString(renderedChildren)}\n</${tag}>`;
  } else if (
    SELF_CLOSING_TAGS.includes(tag) ||
    settings.tailwindGenerationMode === "jsx"
  ) {
    return `\n<${tag}${build}${src} />`;
  } else {
    return `\n<${tag}${build}${src}></${tag}>`;
  }
};

export const tailwindLine = (
  node: LineNode,
  settings: TailwindSettings,
): string => {
  const builder = new TailwindDefaultBuilder(node, settings)
    .commonPositionStyles()
    .commonShapeStyles();

  return `\n<div${builder.build()}></div>`;
};

export const tailwindSection = async (
  node: SectionNode,
  settings: TailwindSettings,
): Promise<string> => {
  const childrenStr = await tailwindWidgetGenerator(node.children, settings);
  const builder = new TailwindDefaultBuilder(node, settings)
    .size()
    .position()
    .customColor(node.fills, "bg");

  const build = builder.build();
  return childrenStr
    ? `\n<div${build}>${indentString(childrenStr)}\n</div>`
    : `\n<div${build}></div>`;
};

export const tailwindCodeGenTextStyles = (): string => {
  if (previousExecutionCache.length === 0) {
    return "// No text styles in this selection";
  }

  return previousExecutionCache
    .map((style) => `// ${style.text}\n${style.style.split(" ").join("\n")}`)
    .join("\n---\n");
};
