/**
 * Centralized API configuration with validation.
 * All environment variables are validated once at module load time.
 */

export type ApiConfig = {
	// Authentication
	apiSecret: string;
	clientToken: string;

	// CORS
	corsOrigins: string[];
	corsAllowWildcard: boolean;
	corsAllowLocalhost: boolean;

	// Rate limiting
	rateLimitWindowMs: number;
	rateLimitMaxRequests: number;

	// Payload limits
	maxPayloadBytes: number;

	// Environment
	isProduction: boolean;
	isDevelopment: boolean;
};

let cachedConfig: ApiConfig | null = null;

function parseOrigins(raw: string): { origins: string[]; allowWildcard: boolean; allowLocalhost: boolean } {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { origins: [], allowWildcard: false, allowLocalhost: false };
	}
	if (trimmed === "*") {
		return { origins: [], allowWildcard: true, allowLocalhost: true };
	}
	const origins = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
	const allowLocalhost = origins.some((o) => o.includes("localhost") || o.includes("127.0.0.1"));
	return { origins, allowWildcard: false, allowLocalhost };
}

function loadConfig(): ApiConfig {
	const isProduction = process.env.NODE_ENV === "production";
	const isDevelopment = process.env.NODE_ENV === "development";

	// API Secret (server-side)
	const apiSecret =
		process.env.INCIDENT_API_SECRET?.trim() ||
		process.env.ADVICE_API_BROWSER_TOKEN?.trim() ||
		"";

	// Client token (for NEXT_PUBLIC_ client-side use)
	const clientToken =
		process.env.NEXT_PUBLIC_INCIDENT_API_TOKEN?.trim() ||
		process.env.NEXT_PUBLIC_ADVICE_API_TOKEN?.trim() ||
		"";

	// CORS configuration
	const corsRaw = process.env.INCIDENT_API_CORS_ORIGIN?.trim() || "";
	const { origins, allowWildcard, allowLocalhost } = parseOrigins(corsRaw);

	// Rate limiting
	const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10) || 60_000;
	const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "30", 10) || 30;

	// Payload limits (default 1MB)
	const maxPayloadBytes = parseInt(process.env.MAX_PAYLOAD_BYTES || "1048576", 10) || 1_048_576;

	return {
		apiSecret,
		clientToken,
		corsOrigins: origins,
		corsAllowWildcard: allowWildcard,
		corsAllowLocalhost: allowLocalhost || isDevelopment,
		rateLimitWindowMs,
		rateLimitMaxRequests,
		maxPayloadBytes,
		isProduction,
		isDevelopment,
	};
}

export function getApiConfig(): ApiConfig {
	if (!cachedConfig) {
		cachedConfig = loadConfig();
	}
	return cachedConfig;
}

export function validateRequiredConfig(): { valid: boolean; missing: string[] } {
	const config = getApiConfig();
	const missing: string[] = [];

	if (!config.apiSecret) {
		missing.push("INCIDENT_API_SECRET");
	}

	// In production, require explicit CORS origins (not wildcard)
	if (config.isProduction && config.corsAllowWildcard) {
		missing.push("INCIDENT_API_CORS_ORIGIN (wildcard not recommended in production)");
	}

	return { valid: missing.length === 0, missing };
}

export function resetConfigCache(): void {
	cachedConfig = null;
}
