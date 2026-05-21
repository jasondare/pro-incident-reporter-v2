/**
 * HTML advice prompts and request parsing for static HTML variants.
 * Server-only — clients send only `variant` + structured `payload`.
 */

import { NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

export type HtmlAdviceVariant =
	| "caregiver"
	| "school"
	| "mandarin"
	| "city"
	| "student";

export type CaregiverPayload = {
	caregiverName: string;
	clientName: string;
	location: string;
	severity: number;
	witnesses: boolean;
	details: string;
};

export type SchoolPayload = {
	teacherName: string;
	studentName: string;
	school: string;
	severity: number;
	involvedOthers: boolean;
	stepsTaken: string;
};

export type MandarinPayload = {
	teacherName: string;
	studentName: string;
	program: string;
	severity: number;
	involvedOthers: boolean;
	stepsTaken: string;
};

export type CityPayload = {
	reporterName: string;
	personDesc: string;
	location: string;
	severity: number;
	unsafe: boolean;
	details: string;
};

export type StudentPayload = {
	reporterName: string;
	studentName: string;
	location: string;
	severity: number;
	involvedOtherStudent: boolean;
	details: string;
};

// ============================================================================
// Prompt Builders
// ============================================================================

export function buildCaregiverPrompt(data: CaregiverPayload): string {
	return `
            You are an expert Director of Nursing and Geriatric Care Specialist.
            A caregiver has submitted the following incident report:
            
            Reporting Caregiver: ${data.caregiverName}
            Client: ${data.clientName}
            Location: ${data.location}
            Severity Level: ${data.severity}/5
            Witnesses Present: ${data.witnesses ? "Yes" : "No"}
            Incident Details: "${data.details}"

            Output Guidelines:
            1. DO NOT include a subject line.
            2. DO NOT include a "Dear [Name]" salutation.
            3. Start immediately with one sentence expressing gratitude and validating the caregiver's report.
            4. Then, immediately provide a list of specific, actionable recommendations (medical/safety, behavioral, communication).
            5. End with a reminder to document this in the official compliance logs.
            `.trim();
}

/** Shared output rules for school + mandarin (teacher) variants and `/api/advice`. */
const TEACHER_INCIDENT_OUTPUT_RULES = `
Output format (use Markdown):
- One short intro line after the thank-you sentence, then a blank line.
- A bullet list using "- " at the start of each line. For each bullet, put a short bold label immediately after the dash, then a colon and the explanation (example: "- **Check in privately:** Schedule a brief conversation to...").
- Do not use nested asterisks or odd spacing; keep bullets clean and readable.
Keep the tone professional but supportive.
`.trim();

export function buildSchoolPrompt(data: SchoolPayload): string {
	return `
You are an expert school counselor and behavioral specialist.
A teacher has submitted the following incident report:

Reporting Teacher: ${data.teacherName}
Student: ${data.studentName}
School: ${data.school}
Severity: ${data.severity}/5
Involved Others: ${data.involvedOthers ? "Yes" : "No"}
Description/Steps Taken: "${data.stepsTaken}"

First, please provide one sentence that shares gratitude, affirmation, and reassurance to the reporting teacher for submitting this report and handling the situation.
Then, provide exactly 3 specific, actionable, and empathetic recommendations for the teacher on how to handle this specific situation, follow up with the student, or prevent future occurrences.

${TEACHER_INCIDENT_OUTPUT_RULES}
`.trim();
}

/** Same shape as `IncidentPayload` — used by Next.js Incident Reporter (`POST /api/advice`). */
export function buildMandarinPrompt(data: MandarinPayload): string {
	return `
You are an expert school counselor and behavioral specialist.
A teacher has submitted the following incident report:

Reporting Teacher: ${data.teacherName}
Student: ${data.studentName}
Program: ${data.program}
Severity: ${data.severity}/5
Involved Others: ${data.involvedOthers ? "Yes" : "No"}
Description/Steps Taken: "${data.stepsTaken}"

First, please provide one sentence that shares gratitude, affirmation, and reassurance to the reporting teacher for submitting this report and handling the situation.
Then, provide exactly 3 specific, actionable, and empathetic recommendations for the teacher on how to handle this specific situation, follow up with the student, or prevent future occurrences.

${TEACHER_INCIDENT_OUTPUT_RULES}
`.trim();
}

export function buildCityPrompt(data: CityPayload): string {
	return `
            You are a City Safety Liaison and Conflict Resolution Specialist. 
            A citizen has reported an incident. 
            
            Report Details:
            Reporter: ${data.reporterName}
            Person(s) involved (description): ${data.personDesc}
            Location: ${data.location}
            Severity: ${data.severity}/5
            Citizen Feels Unsafe: ${data.unsafe ? "YES" : "No"}
            Description: "${data.details}"

            Provide a comprehensive, safety-focused response. 
            
            Structure your response exactly as follows:

            1. **Validation (The Diligent Observer):** - Thank them for acting as a diligent observer. 
               - Reinforce that their report is valuable because it allows official authorities to handle the situation, ensuring the reporter does NOT need to act as a vigilante.
               - Phrase this to validate their "civic duty" while explicitly discouraging personal intervention.

            2. **Immediate Safety & De-escalation (Survivorship Mindset):**
               - Provide immediate steps for right now. 
               - Focus on "Observation over Action."
               - Advise on maintaining distance, avoiding eye contact (if unsafe), and the "Gray Rock" method (being uninteresting/unresponsive) if engaged by an aggressor.
               - Emphasize that "Survivorship" means getting home safe, not "winning" an argument or stopping the crime yourself.

            3. **Future Preparedness (If this happens again):**
               - Give 3 specific tactical recommendations for the future:
               - **Situational Awareness:** Briefly explain Color Code Cooper (being in 'Yellow' - relaxed alert).
               - **Exit Strategy:** Always identifying exits or "safe havens" (stores, public areas) before entering a space.
               - **Verbal De-escalation:** If forced to interact, recommend a calm, low tone and open palms, but prioritizing retreat.

            4. **Closing:** - Reassure them that the report is logged and tracked.
            `.trim();
}

export function buildStudentPrompt(data: StudentPayload): string {
	return `
            You are a supportive, trusted school counselor talking to a high school student (age 13-19).
            The student has just submitted this report:
            
            Reporter: ${data.reporterName}
            Student Needing Help: ${data.studentName}
            Location: ${data.location}
            Severity: ${data.severity}/5
            Involved Another Student: ${data.involvedOtherStudent ? "Yes" : "No"}
            Description: "${data.details}"

            Please provide a response following these rules:
            1. **No Subject Line.** No "Dear [Name]".
            2. **Validation:** Start with 1 sentence thanking them for being brave enough to speak up.
            3. **Action Steps:** Provide 3 very clear, simple steps they can take right now.
               - Step 1 should be about immediate safety or cooling down (e.g., "Walk away", "Go to a safe classroom").
               - Step 2 should be about documentation (e.g., "Write down times", "Screenshot messages").
               - Step 3 should be about connecting (e.g., "Talk to a parent/teacher", "Use the Safe2Tell app").
            4. **Language:** Keep it simple, clear, and direct. Don't use complicated adult words.
            5. **Closing:** Remind them that they did the right thing.
            `.trim();
}

export function buildPromptForVariant(
	variant: HtmlAdviceVariant,
	payload: unknown,
): string {
	switch (variant) {
		case "caregiver":
			return buildCaregiverPrompt(payload as CaregiverPayload);
		case "school":
			return buildSchoolPrompt(payload as SchoolPayload);
		case "mandarin":
			return buildMandarinPrompt(payload as MandarinPayload);
		case "city":
			return buildCityPrompt(payload as CityPayload);
		case "student":
			return buildStudentPrompt(payload as StudentPayload);
	}
}

// ============================================================================
// Request Parsing
// ============================================================================

function str(v: unknown, key: string): string {
	if (typeof v !== "string" || !v.trim()) {
		throw new Error(`Invalid or missing ${key}`);
	}
	return v.trim();
}

function sev(v: unknown): number {
	if (typeof v !== "number" || v < 1 || v > 5 || !Number.isFinite(v)) {
		throw new Error("Invalid severity");
	}
	return v;
}

function bool(v: unknown): boolean {
	if (typeof v !== "boolean") {
		throw new Error("Invalid boolean field");
	}
	return v;
}

export type ParsedHtmlAdvice =
	| { variant: "caregiver"; payload: CaregiverPayload }
	| { variant: "school"; payload: SchoolPayload }
	| { variant: "mandarin"; payload: MandarinPayload }
	| { variant: "city"; payload: CityPayload }
	| { variant: "student"; payload: StudentPayload };

const VARIANTS: HtmlAdviceVariant[] = [
	"caregiver",
	"school",
	"mandarin",
	"city",
	"student",
];

export function parseHtmlAdviceRequest(body: unknown): ParsedHtmlAdvice | NextResponse {
	if (typeof body !== "object" || body === null) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const o = body as Record<string, unknown>;
	const variantRaw = o.variant;
	if (typeof variantRaw !== "string" || !VARIANTS.includes(variantRaw as HtmlAdviceVariant)) {
		return NextResponse.json(
			{ error: "Invalid variant", allowed: VARIANTS },
			{ status: 400 },
		);
	}
	const variant = variantRaw as HtmlAdviceVariant;
	const p = o.payload;
	if (typeof p !== "object" || p === null) {
		return NextResponse.json({ error: "Missing payload" }, { status: 400 });
	}
	const raw = p as Record<string, unknown>;

	try {
		switch (variant) {
			case "caregiver":
				return {
					variant,
					payload: {
						caregiverName: str(raw.caregiverName, "caregiverName"),
						clientName: str(raw.clientName, "clientName"),
						location: str(raw.location, "location"),
						severity: sev(raw.severity),
						witnesses: bool(raw.witnesses),
						details: str(raw.details, "details"),
					},
				};
			case "school":
				return {
					variant,
					payload: {
						teacherName: str(raw.teacherName, "teacherName"),
						studentName: str(raw.studentName, "studentName"),
						school: str(raw.school, "school"),
						severity: sev(raw.severity),
						involvedOthers: bool(raw.involvedOthers),
						stepsTaken: str(raw.stepsTaken, "stepsTaken"),
					},
				};
			case "mandarin":
				return {
					variant,
					payload: {
						teacherName: str(raw.teacherName, "teacherName"),
						studentName: str(raw.studentName, "studentName"),
						program: str(raw.program, "program"),
						severity: sev(raw.severity),
						involvedOthers: bool(raw.involvedOthers),
						stepsTaken: str(raw.stepsTaken, "stepsTaken"),
					},
				};
			case "city":
				return {
					variant,
					payload: {
						reporterName: str(raw.reporterName, "reporterName"),
						personDesc: str(raw.personDesc, "personDesc"),
						location: str(raw.location, "location"),
						severity: sev(raw.severity),
						unsafe: bool(raw.unsafe),
						details: str(raw.details, "details"),
					},
				};
			case "student":
				return {
					variant,
					payload: {
						reporterName: str(raw.reporterName, "reporterName"),
						studentName: str(raw.studentName, "studentName"),
						location: str(raw.location, "location"),
						severity: sev(raw.severity),
						involvedOtherStudent: bool(raw.involvedOtherStudent),
						details: str(raw.details, "details"),
					},
				};
			default: {
				const _e: never = variant;
				return _e;
			}
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Invalid payload";
		return NextResponse.json({ error: msg }, { status: 400 });
	}
}
