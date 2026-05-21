import { NextRequest, NextResponse } from "next/server";

import { handleOptions, parseJsonBody, runApiMiddleware } from "@/lib/api/middleware";
import { generateIncidentAdvice } from "@/lib/gemini";
import { parseIncidentPayloadOrError } from "@/lib/incident";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
	return handleOptions(request);
}

export async function POST(request: NextRequest) {
	const middleware = runApiMiddleware(request, {
		enableCors: true,
		requireJson: true,
		allowedMethods: ["POST"],
		rateLimit: { windowMs: 60_000, maxRequests: 20 },
	});

	if (!middleware.ok) {
		return middleware.response;
	}

	const { headers } = middleware;

	if (!process.env.GEMINI_API_KEY) {
		return NextResponse.json(
			{ error: "AI service not configured", code: "SERVICE_UNAVAILABLE" },
			{ status: 503, headers },
		);
	}

	const body = await parseJsonBody(request, headers);
	if ("error" in body) {
		return body.error;
	}

	const parsed = parseIncidentPayloadOrError(body.data);
	if (parsed instanceof NextResponse) {
		return new NextResponse(parsed.body, {
			status: parsed.status,
			headers: { ...headers, ...Object.fromEntries(parsed.headers.entries()) },
		});
	}

	try {
		const advice = await generateIncidentAdvice(parsed);
		return NextResponse.json({ advice }, { headers });
	} catch (e) {
		console.error("POST /api/advice:", e);
		return NextResponse.json(
			{ error: "AI service temporarily unavailable", code: "BAD_GATEWAY" },
			{ status: 502, headers },
		);
	}
}
