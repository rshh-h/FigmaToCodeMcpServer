import type { StageName } from "./contracts.js";

const STAGES: StageName[] = [
  "resolve_source",
  "probe_capabilities",
  "fetch_snapshot",
  "normalize",
  "generate_code",
  "generate_preview",
  "build_diagnostics",
];

export class StageTimer {
  private readonly durations = new Map<StageName, number>();

  async measure<T>(stage: StageName, task: () => Promise<T> | T): Promise<T> {
    const start = Date.now();
    try {
      return await task();
    } finally {
      this.durations.set(stage, Date.now() - start);
    }
  }

  snapshot(): Record<StageName, number> {
    return STAGES.reduce(
      (acc, stage) => {
        acc[stage] = this.durations.get(stage) ?? 0;
        return acc;
      },
      {} as Record<StageName, number>,
    );
  }
}

