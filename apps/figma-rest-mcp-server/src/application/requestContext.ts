import type {
  CapabilitySnapshot,
  ConversionOptions,
  Framework,
  SourceSnapshot,
  WorkspaceRequestOptions,
} from "../core/contracts.js";
import { StageTimer } from "../core/timing.js";
import { WarningCollector } from "../core/warnings.js";
import { resolveWorkspaceRoot } from "../infrastructure/workspacePaths.js";

export interface RequestContext {
  traceId: string;
  framework: Framework;
  startedAt: number;
  options: ConversionOptions;
  workspace: WorkspaceRequestOptions;
  warningCollector: WarningCollector;
  stageTimer: StageTimer;
  serviceCapabilitySnapshot: CapabilitySnapshot;
  requestCapabilitySnapshot: CapabilitySnapshot;
  sourceSnapshot?: SourceSnapshot;
}

export function createRequestContext(input: {
  traceId: string;
  options: ConversionOptions;
  workspace?: Partial<WorkspaceRequestOptions> & Pick<WorkspaceRequestOptions, "workspaceRoot">;
  serviceCapabilitySnapshot: CapabilitySnapshot;
}): RequestContext {
  return {
    traceId: input.traceId,
    framework: input.options.framework,
    startedAt: Date.now(),
    options: input.options,
    workspace: {
      workspaceRoot: resolveWorkspaceRoot(input.workspace?.workspaceRoot ?? process.cwd()),
      useCache: input.workspace?.useCache ?? true,
    },
    warningCollector: new WarningCollector(),
    stageTimer: new StageTimer(),
    serviceCapabilitySnapshot: input.serviceCapabilitySnapshot,
    requestCapabilitySnapshot: input.serviceCapabilitySnapshot,
  };
}
