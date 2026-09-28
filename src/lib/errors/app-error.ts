import { NextResponse } from "next/server";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = "INTERNAL_SERVER_ERROR",
    statusCode = 500,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Generates a safe, sanitized error payload that never exposes internal stack traces or secrets.
   */
  public toSafeResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && Object.keys(this.details).length > 0 ? { details: this.details } : {}),
      },
    };
  }
}

export class DatabaseError extends AppError {
  constructor(
    message = "The database is currently unavailable.",
    code: ErrorCode = "DATABASE_UNAVAILABLE",
    statusCode = 503
  ) {
    super(message, code, statusCode, true);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required to access this resource.") {
    super(message, "UNAUTHORIZED", 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "FORBIDDEN", 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource", identifier?: string) {
    const msg = identifier ? `${resource} '${identifier}' not found.` : `${resource} not found.`;
    super(msg, "NOT_FOUND", 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, true, details);
  }
}

export class TooManyRequestsError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(message = "Too many requests. Please try again later.", retryAfterSeconds?: number) {
    super(
      message,
      "RATE_LIMIT_EXCEEDED",
      429,
      true,
      retryAfterSeconds !== undefined ? { retryAfterSeconds } : undefined
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected internal server error occurred.") {
    super(message, "INTERNAL_SERVER_ERROR", 500, false);
  }
}

/**
 * Formats any caught error into a safe standard JSON HTTP response.
 * Supports both direct return (return formatErrorResponse(err))
 * and destructured usage (const { body, status } = formatErrorResponse(err)).
 */
export function formatErrorResponse(error: unknown): NextResponse<ApiErrorResponse> & { body: ApiErrorResponse; status: number } {
  let safeResponse: ApiErrorResponse;
  let statusCode: number;

  if (error instanceof AppError) {
    safeResponse = error.toSafeResponse();
    statusCode = error.statusCode;
  } else {
    const fallback = new InternalServerError();
    safeResponse = fallback.toSafeResponse();
    statusCode = fallback.statusCode;
  }

  const response = NextResponse.json(safeResponse, { status: statusCode }) as NextResponse<ApiErrorResponse> & { body: ApiErrorResponse; status: number };
  if (response.body) {
    Object.assign(response.body, safeResponse);
  }
  return response;
}

