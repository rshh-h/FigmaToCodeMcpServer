import type {
  ConversionArtifact,
  DiagnosticsReport,
  SourceSnapshot,
} from "../core/contracts.js";
import type { DiagnosticsBuilder } from "../core/interfaces.js";
import type { RequestContext } from "./requestContext.js";

export class DefaultDiagnosticsBuilder implements DiagnosticsBuilder {
  build(
    context: RequestContext,
    snapshot: SourceSnapshot | undefined,
    artifact: ConversionArtifact,
  ): DiagnosticsReport {
    return {
      adapter: "rest",
      sourceFileKey: snapshot?.fileKey,
      sourceNodeIds: snapshot?.targetNodeIds,
      sourceNodeCount: snapshot?.sourceNodes.length,
      decisions: context.warningCollector.listDecisions(),
      timing: context.stageTimer.snapshot(),
      traceId: context.traceId,
    };
  }
}
