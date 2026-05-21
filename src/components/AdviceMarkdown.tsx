"use client";

import remarkGfm from "remark-gfm";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

type Props = {
	content: string;
};

const components: Components = {
	p: ({ children }) => (
		<p className="mb-4 text-[15px] leading-relaxed text-slate-700 last:mb-0">{children}</p>
	),
	strong: ({ children }) => <strong className="font-semibold text-indigo-950">{children}</strong>,
	em: ({ children }) => <em className="text-slate-600 italic">{children}</em>,
	ul: ({ children }) => <ul className="my-4 list-none space-y-3 pl-0">{children}</ul>,
	ol: ({ children }) => (
		<ol className="my-4 list-decimal space-y-3 pl-6 marker:font-medium marker:text-indigo-600">
			{children}
		</ol>
	),
	li: ({ children }) => (
		<li className="rounded-lg border border-slate-100 bg-gradient-to-br from-white to-indigo-50/40 px-4 py-3.5 text-[15px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100/60">
			<div className="[&_p]:mb-2 [&_p:last-child]:mb-0">{children}</div>
		</li>
	),
};

export function AdviceMarkdown({ content }: Props) {
	return (
		<div className="advice-markdown">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
