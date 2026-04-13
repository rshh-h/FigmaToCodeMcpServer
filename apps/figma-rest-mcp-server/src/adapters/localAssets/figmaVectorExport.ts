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

  const children = Array.isArray(node.children)
    ? node.children.filter(
        (child): child is Record<string, unknown> =>
          Boolean(child) &&
          typeof child === "object" &&
          !isIgnoredNode(child as Record<string, unknown>),
      )
    : [];
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

  const children = Array.isArray(node.children)
    ? node.children.filter(
        (child): child is Record<string, unknown> =>
          Boolean(child) &&
          typeof child === "object" &&
          !isIgnoredNode(child as Record<string, unknown>),
      )
    : [];
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
    !shouldCollapseIntoOnlyExportableChild(node)
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
