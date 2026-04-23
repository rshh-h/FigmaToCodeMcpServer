const getAutoLayoutParent = (
  node: SceneNode,
): (BaseNode &
  LayoutMixin & {
    layoutMode: "NONE" | "VERTICAL" | "HORIZONTAL";
  }) | null => {
  const parent = node.parent;
  if (
    !parent ||
    !("layoutMode" in parent) ||
    parent.layoutMode === "NONE"
  ) {
    return null;
  }

  return parent as BaseNode &
    LayoutMixin & {
      layoutMode: "NONE" | "VERTICAL" | "HORIZONTAL";
    };
};

export const getAutoLayoutMainAxisSizing = (
  node: SceneNode,
): "FIXED" | "HUG" | "FILL" | null => {
  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
    return null;
  }

  const parent = getAutoLayoutParent(node);
  if (!parent) {
    return null;
  }

  if (parent.layoutMode === "VERTICAL") {
    return "layoutSizingVertical" in node ? node.layoutSizingVertical : null;
  }

  if (parent.layoutMode === "HORIZONTAL") {
    return "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : null;
  }

  return null;
};

export const shouldPreventAutoLayoutFlexShrink = (node: SceneNode): boolean => {
  const sizing = getAutoLayoutMainAxisSizing(node);
  return sizing === "FIXED" || sizing === "HUG";
};
