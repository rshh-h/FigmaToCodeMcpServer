const GEOMETRIC_NODE_TYPES = new Set([
  "BOOLEAN_OPERATION",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "RECTANGLE",
  "STAR",
  "VECTOR",
]);

const CONTAINER_NODE_TYPES = new Set([
  "COMPONENT",
  "COMPONENT_SET",
  "FRAME",
  "GROUP",
  "INSTANCE",
  "SECTION",
]);

function hasGeometry(node: Record<string, unknown>): boolean {
  return (
    (Array.isArray(node.fillGeometry) && node.fillGeometry.length > 0) ||
    (Array.isArray(node.strokeGeometry) && node.strokeGeometry.length > 0)
  );
}

function hasImageFill(node: Record<string, unknown>): boolean {
  if (!Array.isArray(node.fills)) {
    return false;
  }

  return node.fills.some(
    (fill) =>
      fill &&
      typeof fill === "object" &&
      (fill as { type?: unknown }).type === "IMAGE",
  );
}

function isBlockedNodeType(node: Record<string, unknown>): boolean {
  return node.type === "TEXT";
}

function isIgnoredNode(node: Record<string, unknown> | null | undefined): boolean {
  return node?.visible === false;
}

type VectorAnalysis = {
  exportable: boolean;
  containsVectorContent: boolean;
  geometricCount: number;
};

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getVisibleChildren(
  node: Record<string, unknown>,
): Record<string, unknown>[] {
  return Array.isArray(node.children)
    ? node.children.filter(
        (child): child is Record<string, unknown> =>
          Boolean(child) &&
          typeof child === "object" &&
          !isIgnoredNode(child as Record<string, unknown>),
      )
    : [];
}

function hasVisiblePaint(
  paints: unknown,
): boolean {
  if (!Array.isArray(paints)) {
    return false;
  }

  return paints.some((paint) => {
    if (!paint || typeof paint !== "object") {
      return false;
    }

    const visible =
      !("visible" in paint) ||
      (paint as { visible?: unknown }).visible !== false;
    const opacity = (paint as { opacity?: unknown }).opacity;

    return visible && (typeof opacity !== "number" || opacity > 0);
  });
}

function getAbsoluteBoundingBox(
  node: Record<string, unknown>,
): BoundingBox | null {
  const box = node.absoluteBoundingBox;
  if (!box || typeof box !== "object") {
    return null;
  }

  const boundingBox = box as {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
  };

  const x = typeof boundingBox.x === "number" ? boundingBox.x : null;
  const y = typeof boundingBox.y === "number" ? boundingBox.y : null;
  const width = typeof boundingBox.width === "number" ? boundingBox.width : null;
  const height =
    typeof boundingBox.height === "number" ? boundingBox.height : null;

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { x, y, width, height };
}

function getArea(box: BoundingBox): number {
  return box.width * box.height;
}

function getOverlapRatio(a: BoundingBox, b: BoundingBox): number {
  const overlapWidth =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapHeight =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }

  const overlapArea = overlapWidth * overlapHeight;
  return overlapArea / Math.min(getArea(a), getArea(b));
}

function isVisuallyEmptyNode(
  node: Record<string, unknown>,
): boolean {
  if (isBlockedNodeType(node)) {
    return false;
  }

  if (hasGeometry(node) || hasVisiblePaint(node.fills) || hasVisiblePaint(node.strokes)) {
    return false;
  }

  const children = getVisibleChildren(node);
  if (children.length > 0) {
    return false;
  }

  return true;
}

function getMeaningfulChildren(
  node: Record<string, unknown>,
): Record<string, unknown>[] {
  return getVisibleChildren(node).filter((child) => !isVisuallyEmptyNode(child));
}

function shouldKeepChildrenSeparate(
  node: Record<string, unknown>,
): boolean {
  if (
    typeof node.type !== "string" ||
    !CONTAINER_NODE_TYPES.has(node.type) ||
    hasGeometry(node)
  ) {
    return false;
  }

  const parentBox = getAbsoluteBoundingBox(node);
  if (!parentBox) {
    return false;
  }

  const parentArea = getArea(parentBox);
  if (parentArea <= 0) {
    return false;
  }

  const candidateChildren = getVisibleChildren(node)
    .map((child) => ({
      child,
      analysis: analyzeNode(child),
      box: getAbsoluteBoundingBox(child),
    }))
    .filter(
      (
        entry,
      ): entry is {
        child: Record<string, unknown>;
        analysis: VectorAnalysis;
        box: BoundingBox;
      } =>
        entry.box !== null &&
        typeof entry.child.type === "string" &&
        CONTAINER_NODE_TYPES.has(entry.child.type) &&
        entry.analysis.containsVectorContent &&
        getArea(entry.box) / parentArea >= 0.18,
    );

  if (candidateChildren.length < 2) {
    return false;
  }

  let separatedPairs = 0;
  let totalPairs = 0;

  for (let index = 0; index < candidateChildren.length; index += 1) {
    for (
      let nextIndex = index + 1;
      nextIndex < candidateChildren.length;
      nextIndex += 1
    ) {
      totalPairs += 1;
      if (
        getOverlapRatio(
          candidateChildren[index].box,
          candidateChildren[nextIndex].box,
        ) <= 0.2
      ) {
        separatedPairs += 1;
      }
    }
  }

  return totalPairs > 0 && separatedPairs === totalPairs;
}

function analyzeNode(node: Record<string, unknown> | null | undefined): VectorAnalysis {
  if (!node || typeof node !== "object" || isIgnoredNode(node)) {
    return {
      exportable: false,
      containsVectorContent: false,
      geometricCount: 0,
    };
  }

  if (isBlockedNodeType(node) || hasImageFill(node)) {
    return {
      exportable: false,
      containsVectorContent: false,
      geometricCount: 0,
    };
  }

  const children = getMeaningfulChildren(node);
  const childAnalyses = children.map((child) => analyzeNode(child));
  const anyChildVectorContent = childAnalyses.some(
    (analysis) => analysis.containsVectorContent,
  );
  const allChildrenExportable =
    children.length > 0 &&
    childAnalyses.every((analysis) => analysis.exportable);

  const type = typeof node.type === "string" ? node.type : "";
  const selfGeometric = GEOMETRIC_NODE_TYPES.has(type) && hasGeometry(node);
  const exportable =
    selfGeometric ||
    (CONTAINER_NODE_TYPES.has(type) &&
      allChildrenExportable &&
      anyChildVectorContent);

  return {
    exportable,
    containsVectorContent: exportable || anyChildVectorContent,
    geometricCount:
      (selfGeometric ? 1 : 0) +
      childAnalyses.reduce((sum, analysis) => sum + analysis.geometricCount, 0),
  };
}

function isAssetLikeRoot(
  node: Record<string, unknown>,
  analysis: VectorAnalysis,
): boolean {
  if (!analysis.exportable) {
    return false;
  }

  if (typeof node.type !== "string") {
    return false;
  }

  if (CONTAINER_NODE_TYPES.has(node.type)) {
    return true;
  }

  if (node.type === "BOOLEAN_OPERATION" || node.type === "VECTOR") {
    return true;
  }

  return analysis.geometricCount > 1;
}

function shouldCollapseIntoOnlyExportableChild(
  node: Record<string, unknown>,
): boolean {
  if (
    typeof node.type !== "string" ||
    !CONTAINER_NODE_TYPES.has(node.type) ||
    hasGeometry(node)
  ) {
    return false;
  }

  const children = getMeaningfulChildren(node);
  const exportableChildren = children.filter(
    (child) => analyzeNode(child).exportable,
  );

  if (exportableChildren.length !== 1) {
    return false;
  }

  return CONTAINER_NODE_TYPES.has(String(exportableChildren[0].type));
}

function collectRoots(
  node: Record<string, unknown> | null | undefined,
  roots: Record<string, unknown>[],
): void {
  if (!node || typeof node !== "object" || isIgnoredNode(node)) {
    return;
  }

  const analysis = analyzeNode(node);
  if (
    isAssetLikeRoot(node, analysis) &&
    !shouldCollapseIntoOnlyExportableChild(node) &&
    !shouldKeepChildrenSeparate(node)
  ) {
    roots.push(node);
    return;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === "object") {
        collectRoots(child as Record<string, unknown>, roots);
      }
    }
  }
}

export function collectVectorExportRoots(
  node: Record<string, unknown>,
): Record<string, unknown>[] {
  const roots: Record<string, unknown>[] = [];
  collectRoots(node, roots);
  return roots;
}

export function toVectorCandidate(node: Record<string, unknown>) {
  return {
    id: String(node.id),
    name: typeof node.name === "string" ? node.name : undefined,
    type: String(node.type),
    hasFillGeometry:
      Array.isArray(node.fillGeometry) && node.fillGeometry.length > 0,
    hasStrokeGeometry:
      Array.isArray(node.strokeGeometry) && node.strokeGeometry.length > 0,
    childCount: Array.isArray(node.children) ? node.children.length : 0,
  };
}
