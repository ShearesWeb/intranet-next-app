"use client";

import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

type ProposalState = "proposing" | "held" | "rejected" | "matched";

interface Proposal {
	student: string;
	cca: string;
	state: ProposalState;
	choiceRank: number;
}

interface Step {
	phase: "setup" | "matching" | "final";
	proposals: Proposal[];
	description: string;
	highlight?: string;
	highlightCca?: string;
}

const STUDENTS = [
	{ id: "alice", name: "Alice", color: "#f97316", prefs: ["swim", "band", "art"] },
	{ id: "bob", name: "Bob", color: "#3b82f6", prefs: ["swim"] },
	{ id: "carol", name: "Carol", color: "#a855f7", prefs: ["band"] },
] as const;

const CCAS = [
	{ id: "swim", name: "Swim", capacity: 1, rankings: ["bob", "alice"] },
	{ id: "band", name: "Band", capacity: 1, rankings: ["carol", "alice", "bob"] },
	{ id: "art", name: "Art", capacity: 1, rankings: ["bob"] },
] as const;

const CHOICE_COLORS = ["#34d399", "#fbbf24", "#fb923c"] as const;

const SX = 100;
const CX = 580;
const STUDENT_YS = [60, 140, 220];
const CCA_YS = [60, 140, 220];

function curvedPath(x1: number, y1: number, x2: number, y2: number) {
	const mx = (x1 + x2) / 2;
	return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

const STEPS: Step[] = [
	{
		phase: "setup",
		proposals: [],
		description:
			"3 students, 3 CCAs — each CCA has 1 slot.\nEach student ranks their preferred CCAs.\nEach CCA's chair ranks applicants.",
	},
	{
		phase: "matching",
		description:
			"Round 1 — everyone proposes to their 1st choice:\n• Alice → Swim\n• Bob → Swim\n• Carol → Band",
		proposals: [
			{ student: "alice", cca: "swim", state: "proposing", choiceRank: 0 },
			{ student: "bob", cca: "swim", state: "proposing", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "proposing", choiceRank: 0 },
		],
	},
	{
		phase: "matching",
		highlight: "alice",
		highlightCca: "swim",
		description:
			"Swim has 2 proposals but only 1 slot.\nSwim's chair ranks Bob higher → holds Bob, rejects Alice.\nBand holds Carol (no competition).",
		proposals: [
			{ student: "alice", cca: "swim", state: "rejected", choiceRank: 0 },
			{ student: "bob", cca: "swim", state: "held", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "held", choiceRank: 0 },
		],
	},
	{
		phase: "matching",
		highlight: "alice",
		description:
			"Round 2 — Alice tries her 2nd choice: Band.\nBand already holds Carol.",
		proposals: [
			{ student: "alice", cca: "band", state: "proposing", choiceRank: 1 },
			{ student: "bob", cca: "swim", state: "held", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "held", choiceRank: 0 },
		],
	},
	{
		phase: "matching",
		highlight: "alice",
		highlightCca: "band",
		description:
			"Band's chair ranks Carol higher than Alice.\nAlice is rejected again. But she still has a 3rd choice…",
		proposals: [
			{ student: "alice", cca: "band", state: "rejected", choiceRank: 1 },
			{ student: "bob", cca: "swim", state: "held", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "held", choiceRank: 0 },
		],
	},
	{
		phase: "matching",
		highlight: "alice",
		description:
			"Round 3 — Alice tries her 3rd choice: Art.\nArt's chair only ranked Bob — not Alice.\nBut Bob is already held by Swim, so Art has an empty slot.",
		proposals: [
			{ student: "alice", cca: "art", state: "proposing", choiceRank: 2 },
			{ student: "bob", cca: "swim", state: "held", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "held", choiceRank: 0 },
		],
	},
	{
		phase: "matching",
		highlight: "alice",
		highlightCca: "art",
		description:
			"Art has room and no other applicants → Alice accepted!\nThe chair didn't rank Alice, but the slot was open.",
		proposals: [
			{ student: "alice", cca: "art", state: "held", choiceRank: 2 },
			{ student: "bob", cca: "swim", state: "held", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "held", choiceRank: 0 },
		],
	},
	{
		phase: "final",
		description:
			"Everyone matched!\n• Bob → Swim ✓\n• Carol → Band ✓\n• Alice → Art ✓ (her 3rd choice saved her)",
		proposals: [
			{ student: "bob", cca: "swim", state: "matched", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "matched", choiceRank: 0 },
			{ student: "alice", cca: "art", state: "matched", choiceRank: 2 },
		],
	},
	{
		phase: "final",
		description:
			"Takeaways:\n• Students — use all 6 preferences. Alice would be unmatched if she'd only listed 2.\n• Chairs — rank at least 200% of your capacity. Art almost ended up empty because the chair only ranked Bob.",
		proposals: [
			{ student: "bob", cca: "swim", state: "matched", choiceRank: 0 },
			{ student: "carol", cca: "band", state: "matched", choiceRank: 0 },
			{ student: "alice", cca: "art", state: "matched", choiceRank: 2 },
		],
	},
];

export function GaleShapleyVisual() {
	const [step, setStep] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const { ref, isInView } = useInView(0.1);
	const [hasStarted, setHasStarted] = useState(false);

	const current = STEPS[step];
	const isFinished = step === STEPS.length - 1;
	const isFinal = current.phase === "final";
	const isSetup = current.phase === "setup";

	useEffect(() => {
		if (isInView && !hasStarted) {
			setHasStarted(true);
			const t = setTimeout(() => setIsPlaying(true), 800);
			return () => clearTimeout(t);
		}
	}, [isInView, hasStarted]);

	useEffect(() => {
		if (!isPlaying) return;
		const delay = current.phase === "setup" ? 6000 : current.phase === "final" ? 7000 : 5000;
		const timer = setTimeout(() => {
			if (step < STEPS.length - 1) setStep((s) => s + 1);
			else setIsPlaying(false);
		}, delay);
		return () => clearTimeout(timer);
	}, [step, isPlaying, current.phase]);

	return (
		<div
			ref={ref}
			className={cn(
				"rounded-2xl bg-slate-950 p-4 md:p-6 shadow-2xl border border-slate-800/60 transition-opacity duration-700",
				isInView ? "opacity-100" : "opacity-0",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-white/90 font-semibold text-sm md:text-base">
					How Gale-Shapley Matching Works
				</h3>
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
							isFinal
								? "bg-emerald-500/15 text-emerald-400"
								: isSetup
									? "bg-blue-500/15 text-blue-400"
									: "bg-orange-500/15 text-orange-400",
						)}
					>
						{isFinal ? "Done" : isSetup ? "Setup" : "Matching"}
					</span>
					<span className="text-slate-500 text-xs font-mono tabular-nums">
						{step + 1}/{STEPS.length}
					</span>
				</div>
			</div>

			{/* Legend */}
			<div className="flex items-center justify-center gap-4 mb-2 flex-wrap">
				{["1st choice", "2nd choice", "3rd choice"].map((label, i) => (
					<span key={label} className="flex items-center gap-1.5 text-[11px]">
						<span className="size-2 rounded-full" style={{ background: CHOICE_COLORS[i] }} />
						<span className="text-slate-500">{label}</span>
					</span>
				))}
			</div>

			{/* SVG */}
			<svg viewBox="0 0 700 280" className="w-full" role="img" aria-label="Gale-Shapley algorithm animation">
				<defs>
					<filter id="gsSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="8" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				<text x={SX} y={22} textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="600" letterSpacing="0.1em">
					STUDENTS
				</text>
				<text x={CX} y={22} textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="600" letterSpacing="0.1em">
					CCAs
				</text>

				{/* Lines */}
				{current.proposals.map((p) => {
					const si = STUDENTS.findIndex((s) => s.id === p.student);
					const ci = CCAS.findIndex((c) => c.id === p.cca);
					if (si === -1 || ci === -1) return null;
					const sy = STUDENT_YS[si];
					const cy = CCA_YS[ci];
					const lineColor = CHOICE_COLORS[p.choiceRank];
					const d = curvedPath(SX + 20, sy, CX - 24, cy);
					const rej = p.state === "rejected";
					const prop = p.state === "proposing";
					const match = p.state === "matched";
					return (
						<g key={`${p.student}-${p.cca}`}>
							{match && (
								<path d={d} stroke="#22c55e" strokeWidth={5} fill="none" opacity={0.12} filter="url(#gsSoftGlow)" className="transition-all duration-700" />
							)}
							{prop && (
								<path d={d} stroke={lineColor} strokeWidth={4} fill="none" opacity={0.15} filter="url(#gsSoftGlow)" className="transition-all duration-700" />
							)}
							<path
								d={d}
								stroke={lineColor}
								strokeWidth={rej ? 1.5 : 2}
								fill="none"
								strokeLinecap="round"
								strokeDasharray={prop ? "8 6" : rej ? "4 4" : "none"}
								opacity={rej ? 0.2 : 0.9}
								className={cn("transition-all duration-700", prop && "animate-[dash-flow_0.8s_linear_infinite]")}
							/>
							{rej && (
								<g className="animate-[fade-in-scale_0.4s_ease-out_both]">
									<circle cx={(SX + 20 + CX - 24) / 2} cy={(sy + cy) / 2} r={9} fill="rgba(239,68,68,0.15)" />
									<text
										x={(SX + 20 + CX - 24) / 2}
										y={(sy + cy) / 2 + 1}
										textAnchor="middle"
										dominantBaseline="central"
										fill="#ef4444"
										fontSize="11"
										fontWeight="bold"
									>
										✕
									</text>
								</g>
							)}
						</g>
					);
				})}

				{/* Student nodes */}
				{STUDENTS.map((s, i) => {
					const y = STUDENT_YS[i];
					const isHighlighted = current.highlight === s.id;
					const proposal = current.proposals.find((p) => p.student === s.id);
					const isRejected = proposal?.state === "rejected";
					const isMatched = proposal?.state === "matched";
					const isUnmatched = isFinal && !proposal;
					return (
						<g key={s.id}>
							{isSetup && (
								<circle
									cx={SX}
									cy={y}
									fill={s.color}
									opacity={0.1}
									className="animate-[node-pulse_1.5s_ease-in-out_infinite]"
									r={24}
									style={{ animationDelay: `${i * 0.12}s` }}
								/>
							)}
							{isHighlighted && (
								<circle cx={SX} cy={y} fill={s.color} opacity={0.15} className="animate-[node-pulse_1.5s_ease-in-out_infinite]" r={26} />
							)}
							<circle
								cx={SX}
								cy={y}
								r={20}
								fill={s.color}
								opacity={isRejected || isUnmatched ? 0.05 : 0.1}
								filter="url(#gsSoftGlow)"
								className="transition-opacity duration-500"
							/>
							<circle
								cx={SX}
								cy={y}
								r={16}
								fill="rgba(15,23,42,0.9)"
								stroke={isMatched ? "#22c55e" : isUnmatched ? "#ef4444" : s.color}
								strokeWidth={isMatched ? 2.5 : isUnmatched ? 1.5 : 2}
								strokeDasharray={isUnmatched ? "4 3" : "none"}
								opacity={isRejected || isUnmatched ? 0.45 : 1}
								className="transition-all duration-500"
							/>
							{isMatched ? (
								<text x={SX} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="#22c55e" fontSize="12" className="animate-[fade-in-scale_0.4s_ease-out_both]">
									✓
								</text>
							) : isUnmatched ? (
								<text x={SX} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="#ef4444" fontSize="12" opacity={0.6}>
									✗
								</text>
							) : (
								<text
									x={SX}
									y={y + 1}
									textAnchor="middle"
									dominantBaseline="central"
									fill={s.color}
									fontSize="12"
									fontWeight="600"
									opacity={isRejected ? 0.4 : 0.8}
								>
									{s.name[0]}
								</text>
							)}
							<text
								x={SX}
								y={y + 30}
								textAnchor="middle"
								fill={isRejected || isUnmatched ? "rgba(148,163,184,0.35)" : "rgba(226,232,240,0.9)"}
								fontSize="11"
								fontWeight="600"
								className="transition-all duration-500"
							>
								{s.name}
							</text>
						</g>
					);
				})}

				{/* CCA nodes */}
				{CCAS.map((c, i) => {
					const y = CCA_YS[i];
					const held = current.proposals.filter((p) => p.cca === c.id && (p.state === "held" || p.state === "matched")).length;
					const isEval = current.highlightCca === c.id;
					const hasIncoming = current.proposals.some((p) => p.cca === c.id && p.state === "proposing");
					return (
						<g key={c.id}>
							{isSetup && (
								<circle
									cx={CX}
									cy={y}
									fill="#fb923c"
									opacity={0.08}
									className="animate-[node-pulse_1.5s_ease-in-out_infinite]"
									r={28}
									style={{ animationDelay: `${i * 0.15}s` }}
								/>
							)}
							{(isEval || hasIncoming) && !isSetup && (
								<circle
									cx={CX}
									cy={y}
									fill={isEval ? "#fbbf24" : "#fb923c"}
									opacity={0.1}
									className="animate-[node-pulse_1.2s_ease-in-out_infinite]"
									r={28}
								/>
							)}
							<circle
								cx={CX}
								cy={y}
								r={24}
								fill={isFinal ? "#22c55e" : "#fb923c"}
								opacity={0.08}
								filter="url(#gsSoftGlow)"
								className="transition-all duration-500"
							/>
							<circle
								cx={CX}
								cy={y}
								r={20}
								fill="rgba(15,23,42,0.9)"
								stroke={isFinal ? "#22c55e" : isEval ? "#fbbf24" : "rgba(148,163,184,0.3)"}
								strokeWidth={isEval ? 2.5 : 2}
								className="transition-all duration-500"
							/>
							<text
								x={CX}
								y={y + 1}
								textAnchor="middle"
								dominantBaseline="central"
								fill={isFinal ? "#22c55e" : "rgba(226,232,240,0.7)"}
								fontSize="11"
								fontWeight="600"
							>
								{held}/{c.capacity}
							</text>
							<text x={CX} y={y + 36} textAnchor="middle" fill="rgba(226,232,240,0.9)" fontSize="11" fontWeight="600">
								{c.name}
							</text>
							<text x={CX} y={y + 49} textAnchor="middle" fill="rgba(148,163,184,0.35)" fontSize="9">
								1 slot
							</text>
						</g>
					);
				})}
			</svg>

			{/* Reference panels */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
				<div
					className={cn(
						"rounded-lg px-3 py-2 border transition-all duration-500",
						isSetup ? "border-orange-500/40 bg-slate-800/50" : "border-slate-800/30 bg-slate-900/30",
					)}
				>
					<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">Student Preferences</p>
					<div className="flex flex-col gap-1">
						{STUDENTS.map((s) => {
							const active = current.proposals.find((p) => p.student === s.id && p.state !== "rejected");
							return (
								<div key={s.id} className="flex items-center gap-1.5 text-[11px]">
									<span className="size-1.5 rounded-full shrink-0" style={{ background: s.color }} />
									<span className="font-medium shrink-0" style={{ color: s.color }}>
										{s.name}
									</span>
									{s.prefs.map((p, j) => {
										const ccaLabel = CCAS.find((c) => c.id === p)?.name ?? p;
										return (
											<span key={p} className="flex items-center">
												<span className={cn(active?.cca === p ? "text-white" : "text-slate-400")}>
													<span className="text-slate-600 mr-px">{j + 1}.</span>
													{ccaLabel}
												</span>
												{j < s.prefs.length - 1 && <span className="text-slate-700 mx-1">·</span>}
											</span>
										);
									})}
								</div>
							);
						})}
					</div>
				</div>
				<div
					className={cn(
						"rounded-lg px-3 py-2 border transition-all duration-500",
						isSetup ? "border-orange-500/40 bg-slate-800/50" : "border-slate-800/30 bg-slate-900/30",
					)}
				>
					<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">Chair Rankings</p>
					<div className="flex flex-col gap-1">
						{CCAS.map((c) => (
							<div key={c.id} className="flex items-center gap-1.5 text-[11px]">
								<span className={cn("font-medium shrink-0", current.highlightCca === c.id ? "text-yellow-300" : "text-slate-300")}>
									{c.name}
								</span>
								<span className="text-slate-600 text-[10px]">({c.capacity})</span>
								<span className="text-slate-700">→</span>
								{c.rankings.map((r, j) => {
									const sColor = STUDENTS.find((s) => s.id === r)?.color ?? "#94a3b8";
									const sName = STUDENTS.find((s) => s.id === r)?.name ?? r;
									return (
										<span key={r} className="flex items-center">
											<span className="text-slate-600 mr-px">{j + 1}.</span>
											<span style={{ color: sColor }}>{sName}</span>
											{j < c.rankings.length - 1 && <span className="text-slate-700 mx-1">·</span>}
										</span>
									);
								})}
								{c.id === "art" && <span className="text-slate-600 text-[10px] ml-1">(only 1 ranked!)</span>}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Description */}
			<div className="min-h-[72px] flex items-start justify-center mt-3 px-2">
				<div key={step} className="animate-[fade-up_0.4s_ease-out_both] max-w-lg w-full">
					{current.description.split("\n").map((line, i) => (
						<p key={i} className={cn("text-sm leading-relaxed", line.startsWith("•") ? "text-slate-400 pl-3" : "text-slate-300")}>
							{line}
						</p>
					))}
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center justify-center gap-2 mt-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={step === 0}
					onClick={() => {
						setIsPlaying(false);
						setStep((s) => Math.max(0, s - 1));
					}}
					className="text-slate-400 hover:text-white hover:bg-slate-800 size-8 p-0"
				>
					<SkipBack className="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsPlaying(!isPlaying)}
					className="text-slate-400 hover:text-white hover:bg-slate-800 size-8 p-0"
				>
					{isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={isFinished}
					onClick={() => {
						setIsPlaying(false);
						setStep((s) => Math.min(STEPS.length - 1, s + 1));
					}}
					className="text-slate-400 hover:text-white hover:bg-slate-800 size-8 p-0"
				>
					<SkipForward className="size-4" />
				</Button>

				<div className="flex items-center gap-1.5 mx-2">
					{STEPS.map((_, i) => (
						<button
							key={i}
							onClick={() => {
								setIsPlaying(false);
								setStep(i);
							}}
							className={cn(
								"rounded-full transition-all duration-300",
								i === step ? "size-2.5 bg-orange-500" : i < step ? "size-1.5 bg-orange-800" : "size-1.5 bg-slate-600 hover:bg-slate-500",
							)}
						/>
					))}
				</div>

				{isFinished && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setStep(0);
							setIsPlaying(true);
						}}
						className="text-slate-400 hover:text-white hover:bg-slate-800 gap-1 text-xs h-7 px-2"
					>
						<RotateCcw className="size-3" />
						Replay
					</Button>
				)}
			</div>
		</div>
	);
}
