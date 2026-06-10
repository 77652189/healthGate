export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INCOMPLETE_SESSION"
  | "RESULT_NOT_READY"
  | "INTERNAL_ERROR";

const defaultMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Invalid request payload.",
  NOT_FOUND: "Resource not found.",
  VERSION_CONFLICT: "Session version is stale.",
  IDEMPOTENCY_CONFLICT: "Idempotency key was already used for a different request.",
  INCOMPLETE_SESSION: "Session is missing required answers.",
  RESULT_NOT_READY: "Assessment result is not ready.",
  INTERNAL_ERROR: "Internal server error."
};

const defaultStatuses: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INCOMPLETE_SESSION: 409,
  RESULT_NOT_READY: 409,
  INTERNAL_ERROR: 500
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, options: { message?: string; status?: number; details?: unknown } = {}) {
    super(options.message ?? defaultMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? defaultStatuses[code];
    this.details = options.details ?? [];
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? []
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR" as const,
        message: defaultMessages.INTERNAL_ERROR,
        details: []
      }
    }
  };
}

