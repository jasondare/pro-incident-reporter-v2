"use client";

import { SEVERITY_LEVELS, getSeverityColor } from "@/constants/severity-levels";

type Props = {
	value: number;
	onChange: (level: number) => void;
};

export function SeveritySelector({ value, onChange }: Props) {
	return (
		<div className="space-y-3">
			<label className="flex justify-between text-sm font-medium text-slate-700">
				Incident Severity
				<span className="text-xs font-normal text-slate-400">1 (Low) - 5 (Severe)</span>
			</label>
			<div className="grid grid-cols-5 gap-1.5 md:gap-2">
				{SEVERITY_LEVELS.map((s) => (
					<button
						key={s.level}
						type="button"
						onClick={() => onChange(s.level)}
						className={`relative flex touch-manipulation flex-col items-center justify-center rounded-lg border-2 p-2 transition-all active:scale-95 md:p-3 ${
							value === s.level
								? getSeverityColor(s.level)
								: "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"
						} `}
					>
						<span className="text-lg font-bold md:text-xl">{s.level}</span>
						<span className="w-full truncate text-center text-[9px] font-semibold tracking-wider uppercase md:text-[10px]">
							{s.label}
						</span>
					</button>
				))}
			</div>
			<p className="px-2 text-center text-xs text-slate-500 italic">
				&quot;{SEVERITY_LEVELS.find((s) => s.level === value)?.desc}&quot;
			</p>
		</div>
	);
}
