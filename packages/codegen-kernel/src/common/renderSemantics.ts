import { commonIsAbsolutePosition } from "./commonPosition";
import { retrieveTopFill } from "./retrieveFill";

export type WrapperReason =
  | "flow-item"
  | "local-coordinate-root"
  | "mask-boundary"
  | "clips-content"
  | "explicit-visual-style";

export type FlattenStrategy = "allow" | "forbid";
export type MergeStrategy = "allow" | "forbid";

export type StructuralRole =
  | "flow-item"
  | "local-layout-root"
  | "mask-root"
  | "transparent-wrapper"
  | "leaf";

export interface RenderSemantics {
  preserveWrapper: boolean;
  preserveWrapperReasons: WrapperReason[];
  structuralRole: StructuralRole;
  flattenStrategy: FlattenStrategy;
  mergeStrategy: MergeStrategy;
  establishesLocalCoordinates: boolean;
  dependsOnChildOffsets: boolean;
  isMaskBoundary: boolean;
  hasMeaningfulChildrenGrouping: boolean;
}

export type SemanticSceneNode = SceneNode & {
  renderSemantics?: RenderSemantics;
};

const DEFAULT_RENDER_SEMANTICS: RenderSemantics = {
  preserveWrapper: false,
  preserveWrapperReasons: [],
  structuralRole: "leaf",
  flattenStrategy: "allow",
  mergeStrategy: "allow",
  establishesLocalCoordinates: false,
  dependsOnChildOffsets: false,
  isMaskBoundary: false,
  hasMeaningfulChildrenGrouping: false,
};

const quantize = (value: number): string => value.toFixed(2);

const getParentNode = (
  node: SceneNode,
  explicitParent?: SceneNode | null,
): SceneNode | null =>
  explicitParent ?? ((node.parent as SceneNode | null | undefined) ?? null);

const isMaskNode = (node: SceneNode): boolean =>
  (node as SceneNode & { isMask?: boolean }).isMask === true;

const hasDirectMaskChild = (node: SceneNode): boolean =>
  "children" in node &&
  node.children.some(
    (child) => (child as SceneNode & { isMask?: boolean }).isMask === true,
  );

const hasVisiblePaints = (paints?: ReadonlyArray<Paint> | PluginAPI["mixed"]) =>
  Array.isArray(paints) && paints.some((paint) => paint.visible !== false);

const hasVisibleEffects = (
  effects?: ReadonlyArray<Effect> | PluginAPI["mixed"],
) => Array.isArray(effects) && effects.some((effect) => effect.visible !== false);

const MERGE_SAFE_DIRECT_CHILD_TYPES = new Set<SceneNode["type"]>([
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "STAR",
  "POLYGON",
  "VECTOR",
  "BOOLEAN_OPERATION",
]);

const hasCornerRadius = (node: SceneNode): boolean =>
  ("cornerRadius" in node &&
    typeof node.cornerRadius === "number" &&
    node.cornerRadius > 0) ||
  ("topLeftRadius" in node &&
    [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].some(
      (radius) => typeof radius === "number" && radius > 0,
    ));

export const hasExplicitVisualStyle = (node: SceneNode): boolean => {
  if (
    "clipsContent" in node &&
    node.clipsContent &&
    "children" in node &&
    node.children.length > 0
  ) {
    return true;
  }

  if ("rotation" in node && typeof node.rotation === "number" && node.rotation !== 0) {
    return true;
  }

  if (
    "opacity" in node &&
    typeof node.opacity === "number" &&
    Math.abs(node.opacity - 1) > 0.001
  ) {
    return true;
  }

  if (
    "blendMode" in node &&
    typeof node.blendMode === "string" &&
    node.blendMode !== "PASS_THROUGH" &&
    node.blendMode !== "NORMAL"
  ) {
    return true;
  }

  if ("fills" in node && hasVisiblePaints(node.fills)) {
    return true;
  }

  if ("strokes" in node && hasVisiblePaints(node.strokes)) {
    return true;
  }

  if ("effects" in node && hasVisibleEffects(node.effects)) {
    return true;
  }

  return hasCornerRadius(node);
};

export const hasMeaningfulRelativeLayout = (node: SceneNode): boolean => {
  if (!("children" in node) || node.children.length < 2) {
    return false;
  }

  const visibleChildren = node.children.filter((child) => child.visible !== false);
  if (visibleChildren.length < 2) {
    return false;
  }

  const distinctX = new Set(visibleChildren.map((child) => quantize(child.x ?? 0)));
  const distinctY = new Set(visibleChildren.map((child) => quantize(child.y ?? 0)));

  return distinctX.size > 1 || distinctY.size > 1;
};

const isImageLikeNode = (node: SceneNode): boolean => {
  const topFill = "fills" in node ? retrieveTopFill(node.fills) : undefined;
  return (
    (node as SceneNode & { localImagePath?: string }).localImagePath !== undefined ||
    topFill?.type === "IMAGE"
  );
};

const hasMergeSensitiveChildren = (node: SceneNode): boolean => {
  if (!("children" in node) || node.children.length < 2) {
    return false;
  }

  const visibleChildren = node.children.filter((child) => child.visible !== false);
  if (visibleChildren.length < 2) {
    return false;
  }

  const imageLikeChildren = visibleChildren.filter(isImageLikeNode);
  if (imageLikeChildren.length > 1) {
    return true;
  }

  return visibleChildren.some(
    (child) => !MERGE_SAFE_DIRECT_CHILD_TYPES.has(child.type),
  );
};

const isFlowItem = (
  node: SceneNode,
  explicitParent?: SceneNode | null,
): boolean => {
  const parent = getParentNode(node, explicitParent);
  if (!parent) {
    return false;
  }

  if (!("layoutMode" in parent) || parent.layoutMode === "NONE") {
    return false;
  }

  if (explicitParent !== undefined && node.parent !== explicitParent) {
    return !("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE");
  }

  return !commonIsAbsolutePosition(node);
};

export const analyzeRenderSemantics = (
  node: SceneNode,
  explicitParent?: SceneNode | null,
): RenderSemantics => {
  const preserveWrapperReasons: WrapperReason[] = [];
  const isMaskBoundary = isMaskNode(node) || hasDirectMaskChild(node);
  const hasLocalCoordinates = hasMeaningfulRelativeLayout(node);
  const flowItem = isFlowItem(node, explicitParent);
  const explicitVisualStyle = hasExplicitVisualStyle(node);
  const clipsContent =
    "clipsContent" in node &&
    node.clipsContent &&
    "children" in node &&
    node.children.length > 0;
  const mergeSensitiveChildren = hasMergeSensitiveChildren(node);

  if (isMaskBoundary) {
    preserveWrapperReasons.push("mask-boundary");
  }
  if (hasLocalCoordinates) {
    preserveWrapperReasons.push("local-coordinate-root");
  }
  if (flowItem) {
    preserveWrapperReasons.push("flow-item");
  }
  if (clipsContent) {
    preserveWrapperReasons.push("clips-content");
  }
  if (explicitVisualStyle) {
    preserveWrapperReasons.push("explicit-visual-style");
  }

  let structuralRole: StructuralRole = "leaf";
  if (isMaskBoundary) {
    structuralRole = "mask-root";
  } else if (hasLocalCoordinates) {
    structuralRole = "local-layout-root";
  } else if (flowItem) {
    structuralRole = "flow-item";
  } else if ("children" in node && node.children.length > 0) {
    structuralRole = "transparent-wrapper";
  }

  return {
    preserveWrapper: preserveWrapperReasons.length > 0,
    preserveWrapperReasons,
    structuralRole,
    flattenStrategy:
      isMaskBoundary || hasLocalCoordinates ? "forbid" : "allow",
    mergeStrategy:
      isMaskBoundary || (hasLocalCoordinates && mergeSensitiveChildren)
        ? "forbid"
        : "allow",
    establishesLocalCoordinates: hasLocalCoordinates,
    dependsOnChildOffsets: hasLocalCoordinates,
    isMaskBoundary,
    hasMeaningfulChildrenGrouping: hasLocalCoordinates,
  };
};

const annotateNode = (
  node: SemanticSceneNode,
  explicitParent?: SceneNode | null,
): void => {
  node.renderSemantics = analyzeRenderSemantics(node, explicitParent);

  if (!("children" in node)) {
    return;
  }

  node.children.forEach((child) => annotateNode(child as SemanticSceneNode, node));
};

export const annotateRenderSemantics = (
  nodes: ReadonlyArray<SceneNode>,
): ReadonlyArray<SceneNode> => {
  nodes.forEach((node) => annotateNode(node as SemanticSceneNode, null));
  return nodes;
};

export const getRenderSemantics = (node: SceneNode): RenderSemantics =>
  (node as SemanticSceneNode).renderSemantics ?? DEFAULT_RENDER_SEMANTICS;

export const shouldPreserveNodeWrapper = (node: SceneNode): boolean =>
  getRenderSemantics(node).preserveWrapper;

export const shouldAllowNodeFlatten = (node: SceneNode): boolean =>
  getRenderSemantics(node).flattenStrategy === "allow";

export const shouldAllowNodeMerge = (node: SceneNode): boolean =>
  getRenderSemantics(node).mergeStrategy === "allow";
