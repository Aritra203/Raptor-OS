import { NextResponse } from "next/server";
import { AppError, InternalServerError, type ApiErrorResponse } from "@/lib/errors/app-error";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * Builds a standardized API v1 JSON success response: { data: ..., meta?: ... }
 */
export function apiSuccess<T>(
  data: T,
  status = 200,
  meta?: PaginationMeta,
  headers?: Record<string, string>
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = { data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/**
 * Builds a standardized API v1 error response.
 * Safely sanitizes internal stack traces and secrets.
 */
export function apiError(
  error: unknown,
  fallbackStatus = 500,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  let status = fallbackStatus;
  let body: ApiErrorResponse;

  if (error instanceof AppError) {
    status = error.statusCode;
    body = error.toSafeResponse();
  } else {
    const fallback = new InternalServerError();
    status = fallback.statusCode;
    body = fallback.toSafeResponse();
  }

  const responseHeaders = new Headers(headers);

  // If rate-limited, ensure Retry-After header is propagated
  if (error instanceof AppError && error.code === "RATE_LIMIT_EXCEEDED") {
    const retryAfter = error.details?.retryAfterSeconds;
    if (retryAfter !== undefined) {
      responseHeaders.set("Retry-After", String(retryAfter));
    }
  }

  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(responseHeaders.entries()),
    },
  });
}
