import {
	type DocumentData,
	FieldValue,
	Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { handleOptions, parseJsonBody, runApiMiddleware } from "@/lib/api/middleware";
import { getIncidentReportsCollection } from "@/lib/firebase/admin";
import { generateIncidentAdvice } from "@/lib/gemini";
import { parseIncidentPayloadOrError } from "@/lib/incident";

export const runtime = "nodejs";

function serializeDoc(id: string, data: DocumentData | undefined): Record<string, unknown> {
	if (!data) return { id };
	const out: Record<string, unknown> = { id };
	for (const [k, v] of Object.entries(data)) {
		if (v instanceof Timestamp) {
			out[k] = v.toDate().toISOString();
		} else {
			out[k] = v;
		}
	}
	return out;
}

export async function OPTIONS(request: NextRequest) {
	return handleOptions(request);
}

export async function GET(request: NextRequest) {
	const middleware = runApiMiddleware(request, {
		enableCors: true,
		allowedMethods: ["GET"],
		rateLimit: { windowMs: 60_000, maxRequests: 60, keyPrefix: "incidents-get" },
	});

	if (!middleware.ok) {
		return middleware.response;
	}

	const { headers, requestId } = middleware;

	try {
		const snap = await getIncidentReportsCollection().get();
		const incidents = snap.docs
			.map((d) => serializeDoc(d.id, d.data()))
			.sort((a, b) => {
				const ta = typeof a.timestamp === "string" ? Date.parse(a.timestamp as string) : 0;
				const tb = typeof b.timestamp === "string" ? Date.parse(b.timestamp as string) : 0;
				return tb - ta;
			});
		return NextResponse.json({ incidents, requestId }, { headers });
	} catch (e) {
		console.error(`[${requestId}] GET /api/incidents:`, e);
		const message = e instanceof Error ? e.message : String(e);
		const isConfig = message.includes("FIREBASE_SERVICE_ACCOUNT");
		return NextResponse.json(
			{
				error: isConfig ? "Storage not configured" : "Failed to load incidents",
				code: isConfig ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
				requestId,
			},
			{ status: isConfig ? 503 : 500, headers },
		);
	}
}

export async function POST(request: NextRequest) {
	const middleware = runApiMiddleware(request, {
		enableCors: true,
		requireJson: true,
		allowedMethods: ["POST"],
		rateLimit: { windowMs: 60_000, maxRequests: 20, keyPrefix: "incidents-post" },
	});

	if (!middleware.ok) {
		return middleware.response;
	}

	const { headers, requestId } = middleware;

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

	let advice: string;
	try {
		advice = await generateIncidentAdvice(parsed);
	} catch (e) {
		console.error(`[${requestId}] Gemini in POST /api/incidents:`, e);
		return NextResponse.json(
			{ error: "AI service temporarily unavailable", code: "BAD_GATEWAY", requestId },
			{ status: 502, headers },
		);
	}

	try {
		const col = getIncidentReportsCollection();
		const docRef = await col.add({
			teacherName: parsed.teacherName,
			studentName: parsed.studentName,
			program: parsed.program,
			severity: parsed.severity,
			involvedOthers: parsed.involvedOthers,
			stepsTaken: parsed.stepsTaken,
			aiAdvice: advice,
			timestamp: FieldValue.serverTimestamp(),
		});
		return NextResponse.json({ advice, id: docRef.id, requestId }, { headers });
	} catch (e) {
		console.error(`[${requestId}] POST /api/incidents:`, e);
		const message = e instanceof Error ? e.message : String(e);
		const isConfig = message.includes("FIREBASE_SERVICE_ACCOUNT");
		return NextResponse.json(
			{
				error: isConfig ? "Storage not configured" : "Failed to save report",
				code: isConfig ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
				requestId,
			},
			{ status: isConfig ? 503 : 500, headers },
		);
	}
}
