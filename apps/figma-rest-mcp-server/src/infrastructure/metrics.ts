import type { Logger } from "./logger.js";

export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  timing(name: string, ms: number, tags?: Record<string, string>): void;
}

export const noopMetrics: Metrics = {
  increment() {},
  timing() {},
};

export class InMemoryMetrics implements Metrics {
  readonly increments: Array<{
    name: string;
    value: number;
    tags?: Record<string, string>;
  }> = [];

  readonly timings: Array<{
    name: string;
    ms: number;
    tags?: Record<string, string>;
  }> = [];

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    this.increments.push({ name, value, tags });
  }

  timing(name: string, ms: number, tags?: Record<string, string>): void {
    this.timings.push({ name, ms, tags });
  }
}

export function createLoggingMetrics(logger: Logger): Metrics {
  return {
    increment(name, value = 1, tags) {
      logger.debug("metric.increment", { metric: name, value, tags });
    },
    timing(name, ms, tags) {
      logger.debug("metric.timing", { metric: name, ms, tags });
    },
  };
}
