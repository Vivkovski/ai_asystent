/**
 * Error codes and API error response shape.
 * Used by apps/web (display) and apps/api (responses).
 */

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "INTEGRATION_TEST_FAILED",
  "NO_SOURCES_AVAILABLE",
  "SYNTHESIS_FAILED",
  "CONNECTOR_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  /** Optional details (e.g. validation errors). Not for secrets. */
  details?: Record<string, unknown>;
}
