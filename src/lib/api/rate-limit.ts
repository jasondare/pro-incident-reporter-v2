/**
 * In-memory rate limiting for API routes.
 * Uses sliding window algorithm with automatic cleanup.
 */

import type { NextRequest } from "next/server";

import { getApiConfig } from "@/lib/api/config";

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

export type RateLimitConfig = {
	windowMs?: number;
	maxRequests?: number;
	keyPrefix?: string;
};

export type RateLimitResult = {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	limit: number;
	clientKey: string;
};

export interface RateLimitStore {
	get(key: string): RateLimitEntry | undefined;
	set(key: string, entry: RateLimitEntry): void;
	delete(key: string): void;
	size: number;
	entries(): IterableIterator<[string, RateLimitEntry]>;
}

class InMemoryStore implements RateLimitStore {
	private map = new Map<string, RateLimitEntry>();

	get(key: string): RateLimitEntry | undefined {
		return this.map.get(key);
	}

	set(key: string, entry: RateLimitEntry): void {
		this.map.set(key, entry);
	}

	delete(key: string): void {
		this.map.delete(key);
	}

	get size(): number {
		return this.map.size;
	}

	entries(): IterableIterator<[string, RateLimitEntry]> {
		return this.map.entries();
	}
}

const defaultStore = new InMemoryStore();
const MAX_STORE_SIZE = 10_000;

function getClientIdentifier(request: NextRequest): string {
	// Firebase/Cloud Run passes client IP via x-forwarded-for
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}

	const realIp = request.headers.get("x-real-ip");
	if (realIp) {
		return realIp.trim();
	}

	// Fallback: use a hash of user-agent + accept-language for some differentiation
	const ua = request.headers.get("user-agent") || "";
	const lang = request.headers.get("accept-language") || "";
	if (ua || lang) {
		return `anon:${simpleHash(ua + lang)}`;
	}

	return "unknown";
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36);
}

function cleanup(store: RateLimitStore): void {
	const now = Date.now();
	const toDelete: string[] = [];
	for (const [key, entry] of store.entries()) {
		if (entry.resetAt <= now) {
			toDelete.push(key);
		}
	}
	for (const key of toDelete) {
		store.delete(key);
	}
}

export function checkRateLimit(
	request: NextRequest,
	config?: RateLimitConfig,
	store: RateLimitStore = defaultStore,
): RateLimitResult {
	const apiConfig = getApiConfig();
	const windowMs = config?.windowMs ?? apiConfig.rateLimitWindowMs;
	const maxRequests = config?.maxRequests ?? apiConfig.rateLimitMaxRequests;
	const keyPrefix = config?.keyPrefix ?? "rl";
	const now = Date.now();

	// Periodic cleanup when store gets large
	if (store.size > MAX_STORE_SIZE) {
		cleanup(store);
	}

	const clientId = getClientIdentifier(request);
	const key = `${keyPrefix}:${clientId}`;
	const entry = store.get(key);

	if (!entry || entry.resetAt <= now) {
		const resetAt = now + windowMs;
		store.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: maxRequests - 1, resetAt, limit: maxRequests, clientKey: clientId };
	}

	entry.count += 1;
	const allowed = entry.count <= maxRequests;
	const remaining = Math.max(0, maxRequests - entry.count);

	return { allowed, remaining, resetAt: entry.resetAt, limit: maxRequests, clientKey: clientId };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
	return {
		"X-RateLimit-Limit": String(result.limit),
		"X-RateLimit-Remaining": String(result.remaining),
		"X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
	};
}

export function getRetryAfterSeconds(result: RateLimitResult): number {
	return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}

export function createRateLimiter(config: RateLimitConfig, store?: RateLimitStore) {
	const s = store ?? new InMemoryStore();
	return (request: NextRequest) => checkRateLimit(request, config, s);
}
