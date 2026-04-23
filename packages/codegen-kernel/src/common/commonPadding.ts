import { PaddingType } from "../pluginTypes.js";

export const commonPadding = (
  node: InferredAutoLayoutResult,
): PaddingType | null => {
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const children =
      "children" in node && Array.isArray(node.children) ? node.children : undefined;
    if (children && children.length === 0) {
      return null;
    }

    const paddingLeft = parseFloat((node.paddingLeft ?? 0).toFixed(2));
    const paddingRight = parseFloat((node.paddingRight ?? 0).toFixed(2));
    const paddingTop = parseFloat((node.paddingTop ?? 0).toFixed(2));
    const paddingBottom = parseFloat((node.paddingBottom ?? 0).toFixed(2));

    if (
      paddingLeft === paddingRight &&
      paddingLeft === paddingBottom &&
      paddingTop === paddingBottom
    ) {
      return { all: paddingLeft };
    } else if (paddingLeft === paddingRight && paddingTop === paddingBottom) {
      return {
        horizontal: paddingLeft,
        vertical: paddingTop,
      };
    } else {
      return {
        left: paddingLeft,
        right: paddingRight,
        top: paddingTop,
        bottom: paddingBottom,
      };
    }
  }

  return null;
};
