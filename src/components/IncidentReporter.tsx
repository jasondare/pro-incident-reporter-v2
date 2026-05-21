"use client";

import {
	AlertCircle,
	BrainCircuit,
	Check,
	CheckCircle2,
	ChevronDown,
	Copy,
	FileText,
	History,
	Loader2,
	School,
	Send,
	ShieldAlert,
	User,
	UserCircle2,
	Users,
} from "lucide-react";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { AdviceMarkdown } from "@/components/AdviceMarkdown";
import { SeveritySelector } from "@/components/SeveritySelector";
import { fetchAppApiGetJson, fetchAppApiJson } from "@/lib/fetch";

interface Incident {
	id?: string;
	teacherName: string;
	studentName: string;
	program: string;
	severity: number;
	involvedOthers: boolean;
	stepsTaken: string;
	timestamp: string | null;
	aiAdvice?: string;
}

const PROGRAMS = [
	"Sunset ES",
	"FSK ES",
	"Daly City",
	"Guadalupe ES",
	"Summer Camp",
	"Private",
	"Other",
];

function incidentTimeMs(i: Incident): number {
	if (!i.timestamp) return 0;
	const t = Date.parse(i.timestamp);
	return Number.isFinite(t) ? t : 0;
}

async function requestSortedIncidents(retries: number): Promise<Incident[]> {
	const data = await fetchAppApiGetJson<{ incidents: Incident[] }>(
		"/api/incidents",
		undefined,
		{ retries, delayMs: 1000 },
	);
	return [...data.incidents].sort((a, b) => incidentTimeMs(b) - incidentTimeMs(a));
}

export default function IncidentReporter() {
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [incidents, setIncidents] = useState<Incident[]>([]);

	const adviceRef = useRef<HTMLDivElement>(null);

	const [formData, setFormData] = useState<Incident>({
		teacherName: "",
		studentName: "",
		program: PROGRAMS[0],
		severity: 1,
		involvedOthers: false,
		stepsTaken: "",
		timestamp: null,
	});

	const [aiLoading, setAiLoading] = useState(false);
	const [lastAdvice, setLastAdvice] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [configError, setConfigError] = useState<string | null>(null);

	const refreshIncidents = useCallback(async () => {
		try {
			const sorted = await requestSortedIncidents(2);
			setIncidents(sorted);
			setConfigError(null);
		} catch {
			setConfigError(
				"Could not load incidents. Check Firebase credentials and that INCIDENT_API_SECRET matches NEXT_PUBLIC_INCIDENT_API_TOKEN.",
			);
		}
	}, []);

	/** Initial load only: `alive` prevents setState after unmount (Strict Mode) from racing. No `loadIncidents` in deps — avoids effect re-firing. */
	useEffect(() => {
		let alive = true;
		void (async () => {
			try {
				const sorted = await requestSortedIncidents(1);
				if (!alive) return;
				setIncidents(sorted);
				setConfigError(null);
			} catch {
				if (!alive) return;
				setConfigError(
					"Could not load incidents. Check Firebase credentials and that INCIDENT_API_SECRET matches NEXT_PUBLIC_INCIDENT_API_TOKEN.",
				);
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);


	const getPreviousIncidents = (name: string) => {
		if (!name) return [];
		return incidents.filter(
			(i) => i.studentName.toLowerCase().trim() === name.toLowerCase().trim(),
		);
	};

	const handleCopy = async () => {
		if (!lastAdvice) return;
		try {
			await navigator.clipboard.writeText(lastAdvice);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy", err);
		}
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
	) => {
		const { name, value, type } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setLastAdvice(null);
		setCopied(false);

		try {
			setAiLoading(true);
			const result = await fetchAppApiJson<{ advice: string; id: string }>(
				"/api/incidents",
				{
					teacherName: formData.teacherName,
					studentName: formData.studentName,
					program: formData.program,
					severity: formData.severity,
					involvedOthers: formData.involvedOthers,
					stepsTaken: formData.stepsTaken,
				},
				undefined,
				{ retries: 3, delayMs: 1000 },
			);
			setLastAdvice(result?.advice ?? null);
			await refreshIncidents();
			setFormData((prev) => ({
				...prev,
				studentName: "",
				severity: 1,
				involvedOthers: false,
				stepsTaken: "",
				teacherName: "",
			}));
		} catch (error) {
			console.error("Submission error:", error);
			alert("Failed to submit report. Please try again.");
		} finally {
			setAiLoading(false);
			setSubmitting(false);
		}
	};

	if (configError) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
				<div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm">
					<div className="mb-2 flex items-center gap-2 font-semibold">
						<AlertCircle className="h-5 w-5 shrink-0" />
						Configuration needed
					</div>
					<p className="text-sm leading-relaxed">{configError}</p>
				</div>
			</div>
		);
	}

	if (loading)
		return (
			<div className="flex h-screen items-center justify-center bg-slate-50">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
			</div>
		);

	const previousIncidents = getPreviousIncidents(formData.studentName);
	const historicalCount = previousIncidents.length;

	const showSplitLayout = Boolean(lastAdvice);

	return (
		<div className="min-h-screen bg-slate-50 font-sans text-slate-800">
			<header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-indigo-600 p-2">
							<ShieldAlert className="h-6 w-6 text-white" />
						</div>
						<h1 className="text-xl leading-none font-bold text-slate-900">
							Incident Reporter
							<span className="mt-1 block text-xs font-normal text-slate-500">Mobile Tool</span>
						</h1>
					</div>
				</div>
			</header>

			<main
				className={
					showSplitLayout
						? "mx-auto flex max-w-6xl flex-col gap-6 p-3 transition-all duration-300 ease-out md:gap-8 md:p-8 lg:flex-row lg:items-start lg:p-8"
						: "mx-auto flex max-w-6xl flex-col items-center gap-6 p-3 md:gap-8 md:p-8"
				}
			>
				<div
					className={
						showSplitLayout
							? "min-h-0 w-full min-w-0 space-y-6 transition-all duration-300 ease-out lg:flex-[7] lg:flex-col"
							: "w-full max-w-xl space-y-6 transition-all duration-300 ease-out md:max-w-2xl"
					}
				>
					<div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						{aiLoading && (
							<div
								className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 px-6 text-center backdrop-blur-sm"
								aria-busy="true"
								aria-live="polite"
							>
								<Loader2 className="h-10 w-10 shrink-0 animate-spin text-indigo-600" />
								<p className="text-sm font-medium text-slate-700">Analyzing details…</p>
								<p className="text-xs text-slate-500">Generating AI recommendations</p>
							</div>
						)}
						<div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 md:px-6">
							<h2 className="flex items-center gap-2 font-semibold text-slate-800">
								<FileText className="h-4 w-4 text-indigo-500" />
								New Incident Report
							</h2>
						</div>

						<form onSubmit={handleSubmit} className="space-y-5 p-4 md:space-y-6 md:p-6">
							<div className="space-y-2">
								<label className="text-sm font-medium text-slate-700">Reporting Teacher</label>
								<div className="relative">
									<input
										type="text"
										name="teacherName"
										value={formData.teacherName}
										onChange={handleInputChange}
										required
										placeholder="e.g. Mrs. Smith"
										className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-base transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:py-2.5"
									/>
									<UserCircle2 className="absolute top-3.5 left-3 h-5 w-5 text-slate-400" />
								</div>
							</div>

							<div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
								<div className="space-y-2">
									<label className="text-sm font-medium text-slate-700">Student Full Name</label>
									<div className="relative">
										<input
											type="text"
											name="studentName"
											value={formData.studentName}
											onChange={handleInputChange}
											required
											placeholder="e.g. John Doe"
											className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-base transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:py-2.5"
										/>
										<User className="absolute top-3.5 left-3 h-5 w-5 text-slate-400" />
									</div>
									{formData.studentName.length > 2 && (
										<div
											className={`mt-1 flex items-center gap-1.5 text-xs transition-all ${
												historicalCount > 0 ? "text-amber-600" : "text-emerald-600"
											}`}
										>
											{historicalCount > 0 ? (
												<>
													<History className="h-3 w-3 shrink-0" />
													<span>
														Found {historicalCount} previous incident
														{historicalCount !== 1 ? "s" : ""}.
													</span>
												</>
											) : (
												<>
													<CheckCircle2 className="h-3 w-3 shrink-0" />
													<span>No previous incidents found.</span>
												</>
											)}
										</div>
									)}
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-slate-700">Program</label>
									<div className="relative">
										<select
											name="program"
											value={formData.program}
											onChange={handleInputChange}
											className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-3 pr-4 pl-10 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:py-2.5"
										>
											{PROGRAMS.map((p) => (
												<option key={p} value={p}>
													{p}
												</option>
											))}
										</select>
										<School className="absolute top-3.5 left-3 h-5 w-5 text-slate-400" />
										<ChevronDown className="pointer-events-none absolute top-3.5 right-3 h-5 w-5 text-slate-400" />
									</div>
								</div>
							</div>

							<SeveritySelector
								value={formData.severity}
								onChange={(level) => setFormData((prev) => ({ ...prev, severity: level }))}
							/>

							<div
								className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 md:p-4"
								onClick={() =>
									setFormData((prev) => ({
										...prev,
										involvedOthers: !prev.involvedOthers,
									}))
								}
							>
								<div className="flex items-center gap-3">
									<Users className="h-5 w-5 text-slate-500" />
									<div>
										<span className="block text-sm font-medium text-slate-700">
											Involved others?
										</span>
										<span className="text-xs text-slate-500">Conflict between students</span>
									</div>
								</div>
								<div className="pointer-events-none relative inline-flex items-center">
									<input
										type="checkbox"
										className="peer sr-only"
										name="involvedOthers"
										checked={formData.involvedOthers}
										readOnly
									/>
									<div className="peer h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-indigo-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
								</div>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium text-slate-700">
									Incident Details & Steps Taken
								</label>
								<textarea
									name="stepsTaken"
									value={formData.stepsTaken}
									onChange={handleInputChange}
									required
									rows={4}
									placeholder="Describe what happened..."
									className="w-full resize-none rounded-lg border border-slate-300 p-3 text-base transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
								/>
							</div>

							<div className="pt-2">
								<button
									type="submit"
									disabled={submitting}
									className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
								>
									{submitting ? (
										<>
											<Loader2 className="h-5 w-5 animate-spin" />
											Processing...
										</>
									) : (
										<>
											<Send className="h-5 w-5" />
											Submit Report
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>

				{lastAdvice && (
					<div
						ref={adviceRef}
						className={
							showSplitLayout
								? "flex min-h-0 w-full min-w-0 scroll-mt-24 flex-col transition-all duration-300 ease-out lg:flex-[5]"
								: "w-full max-w-xl scroll-mt-24 space-y-6 transition-all duration-300 ease-out md:max-w-2xl"
						}
					>
						<div
							className={
								showSplitLayout
									? "flex h-[min(26rem,72svh)] min-h-0 flex-col overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-lg ring-1 ring-indigo-500/20 lg:h-[min(42rem,calc(100svh-10rem))]"
									: "overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-lg ring-1 ring-indigo-500/20"
							}
						>
							<div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white">
								<div className="flex items-center gap-3">
									<BrainCircuit className="h-6 w-6 shrink-0" />
									<h3 className="font-bold">AI Recommendations</h3>
								</div>
								<button
									type="button"
									onClick={handleCopy}
									className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10 p-2 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
									title="Copy to clipboard"
								>
									{copied ? (
										<>
											<Check className="h-4 w-4" />
											<span>Copied</span>
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											<span>Copy</span>
										</>
									)}
								</button>
							</div>
							<div
								className={
									showSplitLayout
										? "flex min-h-0 flex-1 flex-col overflow-hidden bg-indigo-50/30"
										: "bg-indigo-50/30"
								}
							>
								<div
									className={
										showSplitLayout
											? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 [scrollbar-gutter:stable]"
											: "max-h-[min(28rem,60vh)] overflow-y-auto px-6 pt-6 [scrollbar-gutter:stable]"
									}
								>
									<AdviceMarkdown content={lastAdvice} />
								</div>
								<div
									className={
										showSplitLayout
											? "shrink-0 border-t border-indigo-100 px-6 py-4"
											: "border-t border-indigo-100 px-6 pt-4 pb-6"
									}
								>
									<div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
										<AlertCircle className="h-3 w-3 shrink-0" />
										<span>Always follow school safety protocols first.</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
