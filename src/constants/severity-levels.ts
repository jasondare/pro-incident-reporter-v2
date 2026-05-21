export type SeverityLevel = {
	level: number;
	label: string;
	desc: string;
};

export const SEVERITY_LEVELS: readonly SeverityLevel[] = [
	{ level: 1, label: "Low", desc: "Minor misbehavior, foul language" },
	{ level: 2, label: "Mild", desc: "Disruptive, refusing work" },
	{
		level: 3,
		label: "Moderate",
		desc: "Verbal aggression, minor property damage",
	},
	{ level: 4, label: "High", desc: "Threats, major disruption" },
	{ level: 5, label: "Severe", desc: "Physical contact, safety risk" },
] as const;

export function getSeverityColor(level: number): string {
	switch (level) {
		case 1:
			return "border-emerald-500 bg-emerald-50 text-emerald-700";
		case 2:
			return "border-lime-500 bg-lime-50 text-lime-700";
		case 3:
			return "border-amber-500 bg-amber-50 text-amber-700";
		case 4:
			return "border-orange-500 bg-orange-50 text-orange-700";
		case 5:
			return "border-red-600 bg-red-50 text-red-700";
		default:
			return "border-indigo-600 bg-indigo-50 text-indigo-700";
	}
}
