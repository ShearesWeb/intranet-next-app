"use client";

import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

interface Step {
	description: string;
	phase: "intro" | "maincomm" | "caps" | "subcomm" | "summary";
	highlights?: string[];
}

const STUDENTS = [
	{ id: "alice", name: "Alice", color: "#f97316" },
	{ id: "bob", name: "Bob", color: "#3b82f6" },
	{ id: "carol", name: "Carol", color: "#a855f7" },
] as const;

const STEPS: Step[] = [
	{
		phase: "intro",
		description:
			"Allocation runs in two rounds: maincomm first, then subcomm.\nYour subcomm cap depends on how many maincomm positions you got.",
	},
	{
		phase: "maincomm",
		highlights: ["alice"],
		description:
			"Maincomm round results:\n• Alice got 2 positions (Swim lead + Band lead)\n• Max maincomm is 2 — she's full.",
	},
	{
		phase: "maincomm",
		highlights: ["bob"],
		description: "• Bob got 1 position (Art lead)\n• He has room for subcomm.",
	},
	{
		phase: "maincomm",
		highlights: ["carol"],
		description: "• Carol got 0 maincomm positions.\n• She has the most room for subcomm.",
	},
	{
		phase: "caps",
		highlights: ["alice", "bob", "carol"],
		description:
			"Subcomm caps are calculated:\n• 2 maincomm → 0 subcomm (Alice)\n• 1 maincomm → 1 subcomm (Bob)\n• 0 maincomm → 3 subcomm (Carol)",
	},
	{
		phase: "subcomm",
		highlights: ["alice"],
		description:
			"Subcomm round begins.\nAlice is removed — she's already at 2 maincomm, so her subcomm cap is 0.\nShe sits this round out.",
	},
	{
		phase: "subcomm",
		highlights: ["bob", "carol"],
		description:
			"Bob can get 1 subcomm position.\nCarol can get up to 3 subcomm positions.\nThey go through the same matching algorithm.",
	},
	{
		phase: "summary",
		description:
			"The rule:\n• 2 maincomm → 0 subcomm\n• 1 maincomm → 1 subcomm\n• 0 maincomm → 3 subcomm\nTotal positions per person never exceeds 3.",
	},
];

const MAINCOMM_RESULTS: Record<string, { count: number; ccas: string[] }> = {
	alice: { count: 2, ccas: ["Swim lead", "Band lead"] },
	bob: { count: 1, ccas: ["Art lead"] },
	carol: { count: 0, ccas: [] },
};

const SUBCOMM_CAPS: Record<string, number> = { alice: 0, bob: 1, carol: 3 };

export function AllocationCapsVisual() {
	const [step, setStep] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const { ref, isInView } = useInView(0.1);
	const [hasStarted, setHasStarted] = useState(false);

	const current = STEPS[step];
	const isFinished = step === STEPS.length - 1;

	useEffect(() => {
		if (isInView && !hasStarted) {
			setHasStarted(true);
			const t = setTimeout(() => setIsPlaying(true), 800);
			return () => clearTimeout(t);
		}
	}, [isInView, hasStarted]);

	useEffect(() => {
		if (!isPlaying) return;
		const delay = current.phase === "summary" ? 7000 : current.phase === "intro" ? 6000 : 5500;
		const timer = setTimeout(() => {
			if (step < STEPS.length - 1) setStep((s) => s + 1);
			else setIsPlaying(false);
		}, delay);
		return () => clearTimeout(timer);
	}, [step, isPlaying, current.phase]);

	const showCaps =
		current.phase === "caps" || current.phase === "subcomm" || current.phase === "summary";
	const showSubcommState = current.phase === "subcomm" || current.phase === "summary";

	return (
		<div
			ref={ref}
			className={cn(
				"rounded-2xl bg-slate-950 p-4 md:p-6 shadow-2xl border border-slate-800/60 transition-opacity duration-700",
				isInView ? "opacity-100" : "opacity-0",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-white/90 font-semibold text-sm md:text-base">
					Maincomm &amp; Subcomm Caps
				</h3>
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
							current.phase === "summary"
								? "bg-emerald-500/15 text-emerald-400"
								: current.phase === "intro"
									? "bg-blue-500/15 text-blue-400"
									: current.phase === "maincomm"
										? "bg-orange-500/15 text-orange-400"
										: current.phase === "caps"
											? "bg-yellow-500/15 text-yellow-400"
											: "bg-purple-500/15 text-purple-400",
						)}
					>
						{current.phase === "summary"
							? "Rule"
							: current.phase === "intro"
								? "Intro"
								: current.phase === "maincomm"
									? "Maincomm"
									: current.phase === "caps"
										? "Caps"
										: "Subcomm"}
					</span>
					<span className="text-slate-500 text-xs font-mono tabular-nums">
						{step + 1}/{STEPS.length}
					</span>
				</div>
			</div>

			{/* Visual */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
				{STUDENTS.map((s) => {
					const maincomm = MAINCOMM_RESULTS[s.id];
					const cap = SUBCOMM_CAPS[s.id];
					const isHighlighted = current.highlights?.includes(s.id);
					const showMaincomm = current.phase !== "intro";
					const isRemoved = showSubcommState && cap === 0;
					const isActive = showSubcommState && cap > 0;

					return (
						<div
							key={s.id}
							className={cn(
								"relative rounded-xl border p-3 transition-all duration-500",
								isHighlighted
									? "border-slate-600 bg-slate-800/60 shadow-lg"
									: "border-slate-800/40 bg-slate-900/40",
								isRemoved && "opacity-40",
							)}
							style={{
								boxShadow: isHighlighted ? `0 0 20px ${s.color}15` : "none",
							}}
						>
							{/* Name + avatar */}
							<div className="flex items-center gap-2 mb-2">
								<div
									className={cn(
										"size-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
										isRemoved && "border-dashed",
									)}
									style={{
										borderColor: isRemoved ? "#64748b" : s.color,
										background: isRemoved ? "rgba(15,23,42,0.9)" : `${s.color}10`,
									}}
								>
									<span
										className="text-xs font-bold"
										style={{ color: isRemoved ? "#64748b" : s.color }}
									>
										{isRemoved ? "✕" : s.name[0]}
									</span>
								</div>
								<div>
									<span
										className={cn("text-sm font-semibold transition-all duration-500")}
										style={{ color: isRemoved ? "#64748b" : s.color }}
									>
										{s.name}
									</span>
									{isRemoved && <span className="block text-[10px] text-red-400/60">sits out</span>}
								</div>
							</div>

							{/* Maincomm positions */}
							{showMaincomm && (
								<div className="mb-2 animate-[fade-up_0.3s_ease-out_both]">
									<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
										Maincomm
									</p>
									<div className="flex items-center gap-1.5">
										{maincomm.count === 0 ? (
											<span className="text-xs text-slate-600">None</span>
										) : (
											maincomm.ccas.map((cca) => (
												<span
													key={cca}
													className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20"
												>
													{cca}
												</span>
											))
										)}
									</div>
									<p className="text-[11px] text-slate-500 mt-1">{maincomm.count}/2 maincomm</p>
								</div>
							)}

							{/* Cap indicator */}
							{showCaps && (
								<div className="animate-[fade-up_0.3s_ease-out_both]">
									<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
										Subcomm cap
									</p>
									<div className="flex items-center gap-1">
										{Array.from({ length: 3 }).map((_, i) => (
											<div
												key={i}
												className={cn(
													"size-5 rounded-full border flex items-center justify-center transition-all duration-500",
													i < cap
														? "border-emerald-500/50 bg-emerald-500/10"
														: "border-slate-700 bg-slate-900",
												)}
											>
												{i < cap ? (
													<span className="text-[9px] text-emerald-400">✓</span>
												) : (
													<span className="text-[9px] text-slate-700">·</span>
												)}
											</div>
										))}
										<span
											className={cn(
												"text-xs font-semibold ml-1.5",
												cap === 0
													? "text-red-400/60"
													: cap === 3
														? "text-emerald-400"
														: "text-yellow-400",
											)}
										>
											{cap} slot{cap !== 1 ? "s" : ""}
										</span>
									</div>
								</div>
							)}

							{/* Active in subcomm */}
							{isActive && showSubcommState && (
								<div className="mt-2 pt-2 border-t border-slate-800/50 animate-[fade-up_0.3s_ease-out_both]">
									<span className="text-[10px] text-emerald-400/80">→ Enters subcomm round</span>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Summary rule table (on final step) */}
			{current.phase === "summary" && (
				<div className="rounded-lg border border-slate-800/50 bg-slate-900/50 p-3 mb-3 animate-[fade-up_0.4s_ease-out_both]">
					<div className="grid grid-cols-3 gap-2 text-center">
						<div>
							<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Maincomm</p>
							<p className="text-orange-400 text-lg font-bold">2</p>
							<p className="text-slate-500 text-[11px]">→ 0 subcomm</p>
						</div>
						<div>
							<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Maincomm</p>
							<p className="text-yellow-400 text-lg font-bold">1</p>
							<p className="text-slate-500 text-[11px]">→ 1 subcomm</p>
						</div>
						<div>
							<p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Maincomm</p>
							<p className="text-emerald-400 text-lg font-bold">0</p>
							<p className="text-slate-500 text-[11px]">→ 3 subcomm</p>
						</div>
					</div>
				</div>
			)}

			{/* Description */}
			<div className="min-h-[72px] flex items-start justify-center mt-2 px-2">
				<div key={step} className="animate-[fade-up_0.4s_ease-out_both] max-w-lg w-full">
					{current.description.split("\n").map((line, i) => (
						<p
							key={i}
							className={cn(
								"text-sm leading-relaxed",
								line.startsWith("•") ? "text-slate-400 pl-3" : "text-slate-300",
							)}
						>
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
								i === step
									? "size-2.5 bg-orange-500"
									: i < step
										? "size-1.5 bg-orange-800"
										: "size-1.5 bg-slate-600 hover:bg-slate-500",
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
