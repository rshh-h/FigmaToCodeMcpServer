import type { RequestContext } from "../application/requestContext.js";
import type { ConversionArtifact } from "../core/contracts.js";
import type { CodeArtifactWriter } from "../core/interfaces.js";

export class NoopCodeArtifactWriter implements CodeArtifactWriter {
  async write(
    artifact: ConversionArtifact,
    _context: RequestContext,
  ): Promise<ConversionArtifact> {
    return artifact;
  }
}
