import type {
  FigmaSourceRef,
  ResolvedNodeTarget,
} from "../core/contracts.js";
import { ServiceError } from "../core/errors.js";
import type { SourceResolver } from "../core/interfaces.js";

function normalizeNodeId(nodeId: string): string {
  return nodeId.replace(/-/g, ":").trim();
}

function parseFigmaUrl(urlString: string): { fileKey: string; nodeId?: string } {
  const url = new URL(urlString);
  const parts = url.pathname.split("/").filter(Boolean);
  const designIndex = parts.findIndex((part) => part === "design" || part === "file");

  if (designIndex === -1 || !parts[designIndex + 1]) {
    throw new ServiceError({
      category: "ToolValidationError",
      code: "invalid_figma_url",
      stage: "resolve_source",
      message: "The provided Figma URL does not contain a file key.",
      suggestion: "Pass a valid Figma design/file URL with a file key and node-id.",
      retryable: false,
    });
  }

  const nodeId = url.searchParams.get("node-id") ?? undefined;
  return {
    fileKey: parts[designIndex + 1],
    nodeId: nodeId ? normalizeNodeId(nodeId) : undefined,
  };
}

export class FigmaLinkParserAdapter implements SourceResolver {
  resolve(source: FigmaSourceRef): ResolvedNodeTarget {
    const parsed = parseFigmaUrl(source.url);
    const normalizedNodeId = parsed.nodeId ? normalizeNodeId(parsed.nodeId) : undefined;

    if (!normalizedNodeId) {
      throw new ServiceError({
        category: "ToolValidationError",
        code: "missing_source_node_id",
        stage: "resolve_source",
        message: "The request source URL must include the node-id query parameter.",
        suggestion:
          "Pass a Figma URL for a single node, for example https://www.figma.com/design/3JlJhGRKW81I8RTH1Lernb/D2C-test-case?node-id=1-1427&t=mIXdjMtAnUvQcgH6-4",
        retryable: false,
      });
    }

    return {
      fileKey: parsed.fileKey,
      nodeIds: [normalizedNodeId],
      raw: source,
      sourceKind: "url",
    };
  }
}
