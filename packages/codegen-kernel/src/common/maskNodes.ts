import { commonIsAbsolutePosition } from "./commonPosition";

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

  if (!STRUCTURABLE_MASK_NODE_TYPES.has(maskNode.type)) {
    return `Mask node "${maskNode.name}" (${maskNode.id}) is not a simple structural mask shape.`;
  }

  if (maskedNodes.some((node) => !commonIsAbsolutePosition(node))) {
    return `Mask node "${maskNode.name}" (${maskNode.id}) has masked siblings that are not absolutely positioned.`;
  }

  return null;
};

export const buildMaskRenderPlan = (
  nodes: readonly SceneNode[],
): MaskRenderPlanItem[] => {
  const plan: MaskRenderPlanItem[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (!isMaskNode(node)) {
      plan.push({
        kind: "node",
        node,
      });
      continue;
    }

    const maskedNodes = nodes.slice(index + 1);
    const unsupportedReason = getUnsupportedMaskReason(node, maskedNodes);

    if (unsupportedReason) {
      plan.push({
        kind: "node",
        node,
        warning: `${unsupportedReason} Rendering without mask semantics.`,
      });
      continue;
    }

    plan.push({
      kind: "mask-group",
      maskNode: node,
      maskedNodes,
    });
    break;
  }

  return plan;
};
