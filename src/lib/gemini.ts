/**
 * Gemini AI client for incident advice generation.
 */

import type { IncidentPayload } from "@/lib/incident";
import { buildMandarinPrompt } from "@/lib/html-advice";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

function getGeminiModel(): string {
	const fromEnv = process.env.GEMINI_MODEL;
	if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
		return fromEnv.trim();
	}
	return DEFAULT_GEMINI_MODEL;
}

// ============================================================================
// Gemini API Client
// ============================================================================

/** Low-level Gemini call — server only; uses GEMINI_API_KEY. */
export async function callGeminiGenerateContent(prompt: string): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not set");
	}

	const model = getGeminiModel();
	const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }] }],
		}),
	});

	if (!res.ok) {
		const errText = await res.text();
		console.error("Gemini error:", res.status, errText);
		throw new Error("Gemini request failed");
	}

	const data = (await res.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	return (
		data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate advice at this time."
	);
}

// ============================================================================
// Incident Advice Generation
// ============================================================================

export async function generateIncidentAdvice(incident: IncidentPayload): Promise<string> {
	return callGeminiGenerateContent(buildMandarinPrompt(incident));
}
