import type {
  ErrorCategory,
  StageName,
  StandardErrorShape,
} from "./contracts.js";

export class ServiceError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly stage: StageName;
  readonly suggestion: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(shape: StandardErrorShape) {
    super(shape.message);
    this.name = "ServiceError";
    this.category = shape.category;
    this.code = shape.code;
    this.stage = shape.stage;
    this.suggestion = shape.suggestion;
    this.retryable = shape.retryable;
    this.details = shape.details;
  }

  toJSON(): StandardErrorShape {
    return {
      category: this.category,
      code: this.code,
      stage: this.stage,
      message: this.message,
      suggestion: this.suggestion,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

export function toServiceError(
  error: unknown,
  fallback: StandardErrorShape,
): ServiceError {
  if (isServiceError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ServiceError({
      ...fallback,
      message: error.message || fallback.message,
      details: {
        ...fallback.details,
        name: error.name,
      },
    });
  }

  return new ServiceError(fallback);
}
