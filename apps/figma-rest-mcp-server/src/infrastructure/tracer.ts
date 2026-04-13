import { randomUUID } from "node:crypto";

export interface Tracer {
  createTraceId(): string;
}

export const uuidTracer: Tracer = {
  createTraceId() {
    return randomUUID();
  },
};

