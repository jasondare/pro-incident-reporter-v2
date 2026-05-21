/**
 * Unified API middleware for Next.js App Router.
 * Combines security, CORS, validation, and response helpers.
 */

import { type NextRequest, NextResponse } from "next/server";

import { getApiConfig } from "@/lib/api/config";
import {
	checkRateLimit,
	getRateLimitHeaders,
	getRetryAfterSeconds,
	type RateLimitConfig,
} from "./rate-limit";

// ============================================================================
// Constants
// ============================================================================

export const INCIDENT_APP_HEADER = "x-incident-app";
export const INCIDENT_APP_VALUE = "incident-reporter";

// ============================================================================
// Error Codes & Response Helpers
// ============================================================================

export type ApiErrorCode =
	| "BAD_REQUEST"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "METHOD_NOT_ALLOWED"
	| "CONTENT_LENGTH_REQUIRED"
	| "PAYLOAD_TOO_LARGE"
	| "UNSUPPORTED_MEDIA_TYPE"
	| "RATE_LIMITED"
	| "INTERNAL_ERROR"
	| "BAD_GATEWAY"
	| "SERVICE_UNAVAILABLE";

const STATUS_MAP: Record<ApiErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONTENT_LENGTH_REQUIRED: 411,
	PAYLOAD_TOO_LARGE: 413,
	UNSUPPORTED_MEDIA_TYPE: 415,
	RATE_LIMITED: 429,
	INTERNAL_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
};

export type ApiErrorResponse = {
	error: string;
	code: ApiErrorCode;
	requestId?: string;
};

export type ApiSuccessResponse<T> = T & {
	requestId?: string;
};

export function apiError(
	code: ApiErrorCode,
	message: string,
	headers?: HeadersInit,
	requestId?: string,
): NextResponse<ApiErrorResponse> {
	const body: ApiErrorResponse = { error: message, code };
	if (requestId) {
		body.requestId = requestId;
	}
	return NextResponse.json(body, { status: STATUS_MAP[code], headers });
}

export function apiSuccess<T extends object>(
	data: T,
	headers?: HeadersInit,
	requestId?: string,
): NextResponse<ApiSuccessResponse<T>> {
	const body = requestId ? { ...data, requestId } : data;
	return NextResponse.json(body as ApiSuccessResponse<T>, { status: 200, headers });
}

export function apiErrorWithHeaders(
	code: ApiErrorCode,
	message: string,
	baseHeaders: Record<string, string>,
	extraHeaders?: Record<string, string>,
	requestId?: string,
): NextResponse<ApiErrorResponse> {
	const headers = { ...baseHeaders, ...extraHeaders };
	return apiError(code, message, headers, requestId);
}

export function getStatusForCode(code: ApiErrorCode): number {
	return STATUS_MAP[code];
}

// ============================================================================
// Security Utilities
// ============================================================================

export function generateRequestId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 10);
	return `${timestamp}-${random}`;
}

export function getRequestId(request: NextRequest): string {
	return request.headers.get("x-request-id") || generateRequestId();
}

export function getSecurityHeaders(): Record<string, string> {
	return {
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
		"Pragma": "no-cache",
	};
}

export function getJsonResponseHeaders(requestId?: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...getSecurityHeaders(),
	};

	if (requestId) {
		headers["X-Request-ID"] = requestId;
	}

	return headers;
}

export type PayloadValidationResult =
	| { valid: true; contentLength: number }
	| { valid: false; error: string; code: "PAYLOAD_TOO_LARGE" | "CONTENT_LENGTH_REQUIRED" };

export function validatePayloadSize(request: NextRequest): PayloadValidationResult {
	const config = getApiConfig();
	const contentLength = request.headers.get("content-length");

	// For methods with body, require content-length
	if (["POST", "PUT", "PATCH"].includes(request.method)) {
		if (!contentLength) {
			// Don't require content-length for small requests in development
			if (config.isDevelopment) {
				return { valid: true, contentLength: 0 };
			}
			return {
				valid: false,
				error: "Content-Length header required",
				code: "CONTENT_LENGTH_REQUIRED",
			};
		}

		const length = parseInt(contentLength, 10);
		if (isNaN(length) || length < 0) {
			return {
				valid: false,
				error: "Invalid Content-Length header",
				code: "CONTENT_LENGTH_REQUIRED",
			};
		}

		if (length > config.maxPayloadBytes) {
			return {
				valid: false,
				error: `Payload too large. Maximum size is ${formatBytes(config.maxPayloadBytes)}`,
				code: "PAYLOAD_TOO_LARGE",
			};
		}

		return { valid: true, contentLength: length };
	}

	return { valid: true, contentLength: 0 };
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} bytes`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

export function extractBearerToken(request: NextRequest): string {
	const auth = request.headers.get("authorization");
	if (auth?.toLowerCase().startsWith("bearer ")) {
		return auth.slice(7).trim();
	}
	return "";
}

// ============================================================================
// CORS Handling
// ============================================================================

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, x-incident-app, X-Request-ID";
const MAX_AGE = "86400";

function isLocalhostOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return url.hostname === "localhost" || url.hostname === "127.0.0.1";
	} catch {
		return origin.includes("localhost") || origin.includes("127.0.0.1");
	}
}

function isOriginAllowed(origin: string | null): boolean {
	if (!origin) return false;

	const config = getApiConfig();

	if (config.corsAllowWildcard) return true;

	// Allow localhost in development or if explicitly configured
	if (config.corsAllowLocalhost) {
		if (origin === "null") return true; // file:// protocol
		if (isLocalhostOrigin(origin)) return true;
	}

	// Check exact origin match
	return config.corsOrigins.includes(origin);
}

function hasCorsConfigured(): boolean {
	const config = getApiConfig();
	return config.corsOrigins.length > 0 || config.corsAllowWildcard || config.corsAllowLocalhost;
}

export function getCorsHeaders(request: NextRequest): Record<string, string> {
	if (!hasCorsConfigured()) {
		return {};
	}

	const origin = request.headers.get("origin");
	const config = getApiConfig();

	const headers: Record<string, string> = {
		"Access-Control-Allow-Methods": ALLOWED_METHODS,
		"Access-Control-Allow-Headers": ALLOWED_HEADERS,
		"Access-Control-Max-Age": MAX_AGE,
	};

	if (config.corsAllowWildcard) {
		headers["Access-Control-Allow-Origin"] = "*";
		return headers;
	}

	if (origin && isOriginAllowed(origin)) {
		headers["Access-Control-Allow-Origin"] = origin;
		headers["Vary"] = "Origin";
	}

	return headers;
}

export function withCorsHeaders(
	headers: Record<string, string>,
	request: NextRequest,
): Record<string, string> {
	return { ...getCorsHeaders(request), ...headers };
}

export function isOriginBlocked(request: NextRequest): boolean {
	if (!hasCorsConfigured()) {
		return false;
	}
	const origin = request.headers.get("origin");
	if (!origin) return false;
	return !isOriginAllowed(origin);
}

export function getAllowedMethods(): string {
	return ALLOWED_METHODS;
}

export function getAllowedHeaders(): string {
	return ALLOWED_HEADERS;
}

// ============================================================================
// Request Validation
// ============================================================================

export type ValidationOptions = {
	requireJson?: boolean;
	requireAuth?: boolean;
	requireClientHeader?: boolean;
	checkPayloadSize?: boolean;
	allowedMethods?: string[];
	headers?: Record<string, string>;
};

export type ValidationResult =
	| { valid: true }
	| { valid: false; response: NextResponse };

export function validateApiRequest(
	request: NextRequest,
	options?: ValidationOptions,
): ValidationResult {
	const headers = options?.headers || {};
	const requireAuth = options?.requireAuth !== false;
	const requireClientHeader = options?.requireClientHeader !== false;
	const checkPayloadSize = options?.checkPayloadSize !== false;

	// Method validation
	if (options?.allowedMethods && !options.allowedMethods.includes(request.method)) {
		return {
			valid: false,
			response: NextResponse.json(
				{ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
				{ status: 405, headers: { ...headers, Allow: options.allowedMethods.join(", ") } },
			),
		};
	}

	// Payload size validation (for POST/PUT/PATCH)
	if (checkPayloadSize) {
		const payloadResult = validatePayloadSize(request);
		if (!payloadResult.valid) {
			const status = payloadResult.code === "PAYLOAD_TOO_LARGE" ? 413 : 411;
			return {
				valid: false,
				response: NextResponse.json(
					{ error: payloadResult.error, code: payloadResult.code },
					{ status, headers },
				),
			};
		}
	}

	// Authentication validation
	if (requireAuth) {
		const config = getApiConfig();

		if (!config.apiSecret) {
			return {
				valid: false,
				response: NextResponse.json(
					{ error: "Server misconfiguration", code: "SERVICE_UNAVAILABLE" },
					{ status: 503, headers },
				),
			};
		}

		const bearerSent = extractBearerToken(request);
		if (!bearerSent) {
			return {
				valid: false,
				response: NextResponse.json(
					{ error: "Authorization header required", code: "UNAUTHORIZED" },
					{ status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } },
				),
			};
		}

		if (!timingSafeEqual(bearerSent, config.apiSecret)) {
			return {
				valid: false,
				response: NextResponse.json(
					{ error: "Invalid token", code: "FORBIDDEN" },
					{ status: 403, headers },
				),
			};
		}
	}

	// Client identifier validation
	if (requireClientHeader) {
		const clientHeader = request.headers.get(INCIDENT_APP_HEADER);
		if (clientHeader !== INCIDENT_APP_VALUE) {
			return {
				valid: false,
				response: NextResponse.json(
					{ error: "Invalid client identifier", code: "FORBIDDEN" },
					{ status: 403, headers },
				),
			};
		}
	}

	// Content-Type validation for JSON
	if (options?.requireJson) {
		const contentType = request.headers.get("content-type");
		if (!contentType?.includes("application/json")) {
			return {
				valid: false,
				response: NextResponse.json(
					{ error: "Content-Type must be application/json", code: "BAD_REQUEST" },
					{ status: 415, headers },
				),
			};
		}
	}

	return { valid: true };
}

// ============================================================================
// Middleware Orchestration
// ============================================================================

export type MiddlewareConfig = ValidationOptions & {
	enableCors?: boolean;
	rateLimit?: RateLimitConfig;
	includeSecurityHeaders?: boolean;
};

export type MiddlewareResult =
	| {
			ok: true;
			headers: Record<string, string>;
			requestId: string;
	  }
	| {
			ok: false;
			response: NextResponse;
	  };

export function runApiMiddleware(
	request: NextRequest,
	config?: MiddlewareConfig,
): MiddlewareResult {
	const requestId = getRequestId(request);
	const includeSecurityHeaders = config?.includeSecurityHeaders !== false;

	// Build base headers
	const baseHeaders: Record<string, string> = {
		"X-Request-ID": requestId,
		...(includeSecurityHeaders ? getSecurityHeaders() : {}),
	};

	// Add CORS headers
	const corsHeaders = config?.enableCors ? getCorsHeaders(request) : {};
	const headers = { ...baseHeaders, ...corsHeaders };

	// Check origin blocking
	if (config?.enableCors && isOriginBlocked(request)) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Origin not allowed", code: "FORBIDDEN", requestId },
				{ status: 403, headers },
			),
		};
	}

	// Rate limiting
	if (config?.rateLimit) {
		const rateLimitResult = checkRateLimit(request, config.rateLimit);
		const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
		Object.assign(headers, rateLimitHeaders);

		if (!rateLimitResult.allowed) {
			return {
				ok: false,
				response: NextResponse.json(
					{ error: "Too many requests", code: "RATE_LIMITED", requestId },
					{
						status: 429,
						headers: {
							...headers,
							"Retry-After": String(getRetryAfterSeconds(rateLimitResult)),
						},
					},
				),
			};
		}
	}

	// Request validation (auth, method, content-type, payload size)
	const validation = validateApiRequest(request, {
		...config,
		headers,
	});

	if (!validation.valid) {
		return { ok: false, response: validation.response };
	}

	return { ok: true, headers, requestId };
}

export function handleOptions(request: NextRequest): NextResponse {
	const cors = getCorsHeaders(request);
	const securityHeaders = getSecurityHeaders();

	return new NextResponse(null, {
		status: 204,
		headers: {
			...securityHeaders,
			...cors,
		},
	});
}

export async function parseJsonBody<T>(
	request: NextRequest,
	headers: Record<string, string>,
): Promise<{ data: T } | { error: NextResponse }> {
	try {
		const data = await request.json();
		return { data: data as T };
	} catch {
		return {
			error: NextResponse.json(
				{ error: "Invalid JSON body", code: "BAD_REQUEST" },
				{ status: 400, headers },
			),
		};
	}
}

// Re-export types for convenience
export type { RateLimitConfig } from "./rate-limit";
