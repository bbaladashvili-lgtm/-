import axios, { AxiosError } from "axios";
import { APIError, GitHubAPIError, ErrorType } from "../types/api";

/**
 * Production-grade GitHub API client with comprehensive error handling
 */

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Parse GitHub API error response and return user-friendly error details
 */
function parseGitHubError(
  error: AxiosError<GitHubAPIError>
): APIError {
  const status = error.response?.status;
  const data = error.response?.data;

  // Rate limiting
  if (status === 403) {
    const remaining = error.response?.headers["x-ratelimit-remaining"];
    const reset = error.response?.headers["x-ratelimit-reset"];
    const retryAfter = reset ? Math.ceil((Number(reset) * 1000 - Date.now()) / 1000) : 60;

    return {
      type: "RATE_LIMITED",
      message: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
      statusCode: 403,
      retryAfter,
      originalError: error,
    };
  }

  // Not found
  if (status === 404) {
    return {
      type: "NOT_FOUND",
      message: data?.message || "GitHub user not found. Please check the username and try again.",
      statusCode: 404,
      originalError: error,
    };
  }

  // Unauthorized (invalid token)
  if (status === 401) {
    return {
      type: "UNAUTHORIZED",
      message: "Authentication failed. Please check your GitHub token.",
      statusCode: 401,
      originalError: error,
    };
  }

  // Server errors
  if (status && status >= 500) {
    return {
      type: "SERVER_ERROR",
      message: "GitHub servers are currently experiencing issues. Please try again later.",
      statusCode: status,
      originalError: error,
    };
  }

  // Network error (no response from server)
  if (!error.response) {
    return {
      type: "NETWORK_ERROR",
      message: "Network error: Unable to reach GitHub. Please check your connection.",
      originalError: error,
    };
  }

  // Validation errors
  if (status === 422) {
    return {
      type: "INVALID_INPUT",
      message: data?.message || "Invalid request parameters.",
      statusCode: 422,
      originalError: error,
    };
  }

  // Generic error fallback
  return {
    type: "UNKNOWN_ERROR",
    message: data?.message || "An unexpected error occurred. Please try again.",
    statusCode: status,
    originalError: error,
  };
}

/**
 * Validate username input
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter a GitHub username.",
    };
  }

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: "Username must be at least 2 characters long.",
    };
  }

  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, and hyphens.",
    };
  }

  return { valid: true };
}

/**
 * Fetch GitHub user with production-grade error handling
 */
export async function fetchGitHubUser(
  username: string
): Promise<{ success: boolean; data?: any; error?: APIError }> {
  // Validate input
  const validation = validateUsername(username);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        type: "INVALID_INPUT",
        message: validation.error || "Invalid username",
      },
    };
  }

  try {
    const token = import.meta.env.VITE_GITHUB_TOKEN;
    const headers = token ? { Authorization: `token ${token}` } : {};

    const response = await axios.get(`${GITHUB_API_BASE}/users/${username.trim()}`, {
      headers,
      timeout: 10000, // 10 second timeout
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    const error = err as AxiosError<GitHubAPIError>;

    return {
      success: false,
      error: parseGitHubError(error),
    };
  }
}

/**
 * Get user-friendly error message with optional action
 */
export function getErrorMessage(error: APIError): {
  message: string;
  action?: string;
  severity: "error" | "warning" | "info";
} {
  switch (error.type) {
    case "RATE_LIMITED":
      return {
        message: error.message,
        action: error.retryAfter
          ? `Try again in ${error.retryAfter} seconds or use a GitHub token for higher limits.`
          : "Use a GitHub personal access token for higher rate limits.",
        severity: "warning",
      };

    case "NOT_FOUND":
      return {
        message: error.message,
        action: "Double-check the spelling and try again.",
        severity: "error",
      };

    case "UNAUTHORIZED":
      return {
        message: error.message,
        action: "Check your GitHub token in environment variables.",
        severity: "error",
      };

    case "NETWORK_ERROR":
      return {
        message: error.message,
        action: "Check your internet connection and try again.",
        severity: "warning",
      };

    case "INVALID_INPUT":
      return {
        message: error.message,
        severity: "info",
      };

    case "SERVER_ERROR":
      return {
        message: error.message,
        action: "GitHub is experiencing issues. Please try again in a moment.",
        severity: "warning",
      };

    default:
      return {
        message: error.message,
        action: "Please try again.",
        severity: "error",
      };
  }
}
