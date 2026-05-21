import { NextRequest, NextResponse } from "next/server";

import { handleOptions, parseJsonBody, runApiMiddleware } from "@/lib/api/middleware";
import { callGeminiGenerateContent } from "@/lib/gemini";
import { buildPromptForVariant, parseHtmlAdviceRequest } from "@/lib/html-advice";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
	return handleOptions(request);
}

export async function POST(request: NextRequest) {
	const middleware = runApiMiddleware(request, {
		enableCors: true,
		requireJson: true,
		allowedMethods: ["POST"],
		rateLimit: { windowMs: 60_000, maxRequests: 20, keyPrefix: "ai-advice" },
	});

	if (!middleware.ok) {
		return middleware.response;
	}

	const { headers, requestId } = middleware;

	if (!process.env.GEMINI_API_KEY) {
		return NextResponse.json(
			{ error: "AI service not configured", code: "SERVICE_UNAVAILABLE", requestId },
			{ status: 503, headers },
		);
	}

	const body = await parseJsonBody(request, headers);
	if ("error" in body) {
		return body.error;
	}

	const parsed = parseHtmlAdviceRequest(body.data);
	if (parsed instanceof NextResponse) {
		return new NextResponse(parsed.body, {
			status: parsed.status,
			headers: { ...headers, ...Object.fromEntries(parsed.headers.entries()) },
		});
	}

	const prompt = buildPromptForVariant(parsed.variant, parsed.payload);

	try {
		const advice = await callGeminiGenerateContent(prompt);
		return NextResponse.json({ advice, requestId }, { headers });
	} catch (e) {
		console.error(`[${requestId}] POST /api/ai/advice:`, e);
		return NextResponse.json(
			{ error: "AI service temporarily unavailable", code: "BAD_GATEWAY", requestId },
			{ status: 502, headers },
		);
	}
}
