import type { FigmaNodeLike, VectorCandidate } from "../core/contracts.js";

const VECTOR_LIKE_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "ELLIPSE",
  "POLYGON",
]);

function hasNonEmptyGeometry(geometry: unknown): boolean {
  return Array.isArray(geometry) && geometry.length > 0;
}

export function classifyVectorCandidate(
  node: FigmaNodeLike,
  depth: number,
): VectorCandidate | undefined {
  if (node.visible === false || node.type === "TEXT") {
    return undefined;
  }

  const hasGeometry =
    hasNonEmptyGeometry((node as Record<string, unknown>).fillGeometry) ||
    hasNonEmptyGeometry((node as Record<string, unknown>).strokeGeometry);
  const type = String(node.type ?? "");

  if (!hasGeometry && !VECTOR_LIKE_TYPES.has(type)) {
    return undefined;
  }

  return {
    id: node.id,
    name: node.name,
    depth,
    reason: hasGeometry ? "geometry" : "vector-like-node",
  };
}
