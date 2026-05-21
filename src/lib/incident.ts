/**
 * Incident payload types and validation.
 */

import { NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

export type IncidentPayload = {
	teacherName: string;
	studentName: string;
	program: string;
	severity: number;
	involvedOthers: boolean;
	stepsTaken: string;
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates JSON body for incident advice + storage. Returns a 400 response or the parsed payload.
 */
export function parseIncidentPayloadOrError(
	body: unknown,
): IncidentPayload | NextResponse {
	if (typeof body !== "object" || body === null) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const o = body as Record<string, unknown>;

	const strings: (keyof Pick<
		IncidentPayload,
		"teacherName" | "studentName" | "program" | "stepsTaken"
	>)[] = ["teacherName", "studentName", "program", "stepsTaken"];
	for (const key of strings) {
		const v = o[key];
		if (typeof v !== "string" || !v.trim()) {
			return NextResponse.json({ error: `Missing or invalid ${key}` }, { status: 400 });
		}
	}
	if (typeof o.severity !== "number" || o.severity < 1 || o.severity > 5) {
		return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
	}
	if (typeof o.involvedOthers !== "boolean") {
		return NextResponse.json({ error: "Invalid involvedOthers" }, { status: 400 });
	}

	return {
		teacherName: (o.teacherName as string).trim(),
		studentName: (o.studentName as string).trim(),
		program: (o.program as string).trim(),
		severity: o.severity,
		involvedOthers: o.involvedOthers,
		stepsTaken: (o.stepsTaken as string).trim(),
	};
}
