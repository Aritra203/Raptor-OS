import type { PaginationMeta } from "@/lib/api/response";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Extracts and sanitizes page and limit parameters from URL searchParams.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = DEFAULT_LIMIT,
  maxLimit = MAX_LIMIT
): PaginationParams {
  const rawPage = parseInt(searchParams.get("page") || "", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "", 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  let limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Generates pagination metadata for standard API v1 responses.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
