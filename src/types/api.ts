/**
 * API Error handling types
 */

export interface GitHubAPIError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    message: string;
    resource: string;
    field: string;
    code: string;
  }>;
}

export type ErrorType =
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NETWORK_ERROR"
  | "INVALID_INPUT"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

export interface APIError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  retryAfter?: number; // seconds
  originalError?: Error;
}
