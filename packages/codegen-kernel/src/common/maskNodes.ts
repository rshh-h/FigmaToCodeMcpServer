import { commonIsAbsolutePosition } from "./commonPosition.js";
import { getRenderSemantics } from "./renderSemantics.js";

type MaskType = "ALPHA" | "VECTOR" | "LUMINANCE";

export type MaskRenderPlanItem =
  | {
      kind: "node";
      node: SceneNode;
      warning?: string;
    }
  | {
      kind: "mask-group";
      maskNode: SceneNode;
      maskedNodes: readonly SceneNode[];
      warning?: string;
    };

const STRUCTURABLE_MASK_NODE_TYPES = new Set<SceneNode["type"]>([
  "RECTANGLE",
  "ELLIPSE",
]);

const getMaskType = (node: SceneNode): MaskType =>
  (((node as SceneNode & { maskType?: MaskType }).maskType as MaskType | undefined) ??
    "ALPHA");

const isMaskNode = (node: SceneNode): boolean =>
  (node as SceneNode & { isMask?: boolean }).isMask === true;

const isMaskBoundaryNode = (node: SceneNode): boolean =>
  isMaskNode(node) || getRenderSemantics(node).isMaskBoundary;

const collectMaskedNodes = (
  nodes: readonly SceneNode[],
  startIndex: number,
): readonly SceneNode[] => {
  const maskedNodes: SceneNode[] = [];

  for (let index = startIndex; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (isMaskBoundaryNode(node)) {
      break;
    }
    maskedNodes.push(node);
  }

  return maskedNodes;
};

const getUnsupportedMaskReason = (
  maskNode: SceneNode,
  maskedNodes: readonly SceneNode[],
): string | null => {
  if (maskedNodes.length === 0) {
    return `Mask node "${maskNode.name}" (${maskNode.id}) has no subsequent siblings to mask.`;
  }

  const maskType = getMaskType(maskNode);
  if (maskType === "LUMINANCE") {
    return `Mask node "${maskNode.name}" (${maskNode.id}) uses unsupported maskType "${maskType}".`;
  }

  if (!STRUCTURABLE_MASK_NODE_TYPES.has(maskNode.type) && maskNode.type !== "VECTOR") {
    return `Mask node "${maskNode.name}" (${maskNode.id}) is not a simple structural mask shape.`;
  }

  if (maskedNodes.some((node) => !commonIsAbsolutePosition(node))) {
    return `Mask node "${maskNode.name}" (${maskNode.id}) has masked siblings that are not absolutely positioned.`;
  }

  return null;
};

const getMaskApproximationWarning = (maskNode: SceneNode): string | undefined => {
  if (maskNode.type === "VECTOR") {
    return `Mask node "${maskNode.name}" (${maskNode.id}) is a VECTOR mask and is being approximated with rectangular overflow clipping.`;
  }

  return undefined;
};

export const buildMaskRenderPlan = (
  nodes: readonly SceneNode[],
): MaskRenderPlanItem[] => {
  const plan: MaskRenderPlanItem[] = [];

  for (let index = 0; index < nodes.length; ) {
    const node = nodes[index];

    if (!isMaskNode(node)) {
      plan.push({
        kind: "node",
        node,
      });
      index += 1;
      continue;
    }

    const maskedNodes = collectMaskedNodes(nodes, index + 1);
    const unsupportedReason = getUnsupportedMaskReason(node, maskedNodes);

    if (unsupportedReason) {
      plan.push({
        kind: "node",
        node,
        warning: `${unsupportedReason} Rendering without mask semantics.`,
      });
      index += 1;
      continue;
    }

    plan.push({
      kind: "mask-group",
      maskNode: node,
      maskedNodes,
      warning: getMaskApproximationWarning(node),
    });
    index += maskedNodes.length + 1;
  }

  return plan;
};
