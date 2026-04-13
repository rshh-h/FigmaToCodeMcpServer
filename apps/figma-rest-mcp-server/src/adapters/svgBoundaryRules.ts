import type { FigmaNodeLike, VectorCandidate } from "../core/contracts.js";

const VECTOR_LIKE_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "ELLIPSE",
  "POLYGON",
]);

export function classifyVectorCandidate(
  node: FigmaNodeLike,
  depth: number,
): VectorCandidate | undefined {
  const hasGeometry =
    Array.isArray((node as Record<string, unknown>).fillGeometry) ||
    Array.isArray((node as Record<string, unknown>).strokeGeometry);
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
