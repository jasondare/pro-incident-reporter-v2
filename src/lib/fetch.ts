/**
 * Client-side fetch utilities with retry and app identification headers.
 */

import { INCIDENT_APP_HEADER, INCIDENT_APP_VALUE } from "@/lib/api/middleware";

export type FetchWithRetryOptions = {
	/** Max attempts including the first (default: 3) */
	retries?: number;
	/** Base delay in ms before retry; exponential backoff applied (default: 1000) */
	delayMs?: number;
};

const defaultRetries = 3;
const defaultDelayMs = 1000;

/**
 * Same-origin `fetch` with retries on network/HTTP failure.
 * Returns the parsed JSON body. Throws on final failure.
 */
export async function fetchWithRetry<T = unknown>(
	input: RequestInfo | URL,
	init?: RequestInit,
	options?: FetchWithRetryOptions,
): Promise<T> {
	const retries = options?.retries ?? defaultRetries;
	const delayMs = options?.delayMs ?? defaultDelayMs;

	let lastError: unknown;

	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(input, init);
			if (!response.ok) {
				const errBody = await response.json().catch(() => ({}));
				const message =
					typeof (errBody as { error?: string }).error === "string"
						? (errBody as { error: string }).error
						: `HTTP error! status: ${response.status}`;
				throw new Error(message);
			}
			return (await response.json()) as T;
		} catch (err) {
			lastError = err;
			if (i === retries - 1) {
				throw lastError;
			}
			await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, i)));
		}
	}

	throw lastError;
}

/**
 * Identification headers for calls to this app's API routes (no `Content-Type` — safe for GET).
 * `Authorization: Bearer` must match `INCIDENT_API_SECRET`; `x-incident-app` identifies the client.
 */
export function getAppApiIdentityHeaders(extra?: HeadersInit): Headers {
	const headers = new Headers(extra);

	headers.set(INCIDENT_APP_HEADER, INCIDENT_APP_VALUE);

	const token =
		(typeof process.env.NEXT_PUBLIC_INCIDENT_API_TOKEN === "string"
			? process.env.NEXT_PUBLIC_INCIDENT_API_TOKEN.trim()
			: "") ||
		(typeof process.env.NEXT_PUBLIC_ADVICE_API_TOKEN === "string"
			? process.env.NEXT_PUBLIC_ADVICE_API_TOKEN.trim()
			: "");

	if (!token) {
		if (process.env.NODE_ENV === "development") {
			console.warn(
				"[fetch] Set NEXT_PUBLIC_INCIDENT_API_TOKEN in .env.local (same value as INCIDENT_API_SECRET).",
			);
		}
	} else {
		headers.set("Authorization", `Bearer ${token}`);
	}

	return headers;
}

/**
 * `fetchWithRetry` plus identity headers and JSON body (sets `Content-Type` when missing).
 */
export async function fetchAppApiJson<T = unknown>(
	path: string,
	body: unknown,
	init?: Omit<RequestInit, "body" | "method">,
	retryOptions?: FetchWithRetryOptions,
): Promise<T> {
	const headers = mergeHeaders(getAppApiIdentityHeaders(), init?.headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	return fetchWithRetry<T>(
		path,
		{
			method: "POST",
			...init,
			headers,
			body: JSON.stringify(body),
		},
		retryOptions,
	);
}

/**
 * Same-origin GET with app identity headers and retry (for `/api/*` routes).
 */
export async function fetchAppApiGetJson<T = unknown>(
	path: string,
	init?: Omit<RequestInit, "method" | "body">,
	retryOptions?: FetchWithRetryOptions,
): Promise<T> {
	const headers = mergeHeaders(getAppApiIdentityHeaders(), init?.headers);

	return fetchWithRetry<T>(
		path,
		{
			method: "GET",
			...init,
			headers,
		},
		retryOptions,
	);
}

function mergeHeaders(base: Headers, extra?: HeadersInit): Headers {
	const out = new Headers(base);
	if (!extra) return out;
	const e = new Headers(extra);
	e.forEach((value, key) => {
		out.set(key, value);
	});
	return out;
}

/**
 * Same-origin `fetch` with app identification headers (for GET or custom bodies later).
 */
export function fetchWithAppHeaders(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	return fetch(input, {
		...init,
		headers: mergeHeaders(getAppApiIdentityHeaders(), init?.headers),
	});
}
