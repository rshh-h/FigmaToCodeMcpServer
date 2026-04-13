import type {
  FigmaNodeLike,
  ImageHint,
  ResolvedNodeTarget,
  SourceSnapshot,
  VectorCandidate,
} from "../core/contracts.js";
import type { SnapshotAdapter, SourceGateway } from "../core/interfaces.js";
import { classifyVectorCandidate } from "./svgBoundaryRules.js";

function collectImageRefs(
  node: FigmaNodeLike,
  path: string,
  acc: ImageHint[],
): void {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  for (const fill of fills) {
    const imageRef = fill?.imageRef;
    if (typeof imageRef === "string") {
      acc.push({
        imageRef,
        path,
      });
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectImageRefs(child, `${path}/${child.id}`, acc);
    }
  }
}

function collectVectorCandidates(
  node: FigmaNodeLike,
  depth: number,
  acc: VectorCandidate[],
): void {
  const candidate = classifyVectorCandidate(node, depth);
  if (candidate) {
    acc.push(candidate);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectVectorCandidates(child, depth + 1, acc);
    }
  }
}

export class SourceSnapshotAdapter implements SnapshotAdapter {
  build(
    target: ResolvedNodeTarget,
    gatewayData: Awaited<ReturnType<SourceGateway["fetchNodes"]>>,
    images: Record<string, string>,
    vectors: Record<string, string>,
    variablesRaw?: unknown,
    requestCount = 1,
  ): SourceSnapshot {
    const imageHints: ImageHint[] = [];
    const vectorCandidates: VectorCandidate[] = [];
    const seenVectorCandidates = new Set<string>();

    for (const document of gatewayData.documents) {
      collectImageRefs(document.document as FigmaNodeLike, document.nodeId, imageHints);
      collectVectorCandidates(document.document as FigmaNodeLike, 0, vectorCandidates);
    }

    const dedupedVectorCandidates = vectorCandidates.filter((candidate) => {
      if (seenVectorCandidates.has(candidate.id)) {
        return false;
      }
      seenVectorCandidates.add(candidate.id);
      return true;
    });

    return {
      fileKey: gatewayData.fileKey,
      targetNodeIds: target.nodeIds,
      sourceNodes: gatewayData.documents.map((entry) => ({
        nodeId: entry.nodeId,
        document: entry.document as FigmaNodeLike,
      })),
      imageRefs: [...new Set(imageHints.map((hint) => hint.imageRef))],
      imageUrls: images,
      vectorCandidates: dedupedVectorCandidates,
      vectorUrls: vectors,
      variablesRaw,
      metadata: {
        fetchedAt: new Date().toISOString(),
        requestCount,
      },
    };
  }
}
