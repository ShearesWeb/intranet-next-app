"use client";

import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

type Highlight = "none" | "chair" | "positions" | "members" | "all";

interface Step {
	phase: string;
	description: string;
	badge?: string;
	highlight: Highlight;
	showPosHours?: boolean;
	showMemberDecl?: boolean;
	showLocked?: boolean;
	showMissed?: boolean;
	showTotals?: boolean;
}

interface DayEntry {
	day: string;
	hrs: number;
	reason: string;
}

const POSITIONS = [
	{ id: "swimmer", label: "Swimmer" },
	{ id: "mgr", label: "Team Manager" },
] as const;

const POS_DAILY: Record<string, DayEntry[]> = {
	swimmer: [
		{ day: "Mon", hrs: 3, reason: "Training session" },
		{ day: "Tue", hrs: 3, reason: "Training session" },
		{ day: "Wed", hrs: 3, reason: "Competition prep" },
		{ day: "Thu", hrs: 3, reason: "Competition prep" },
		{ day: "Fri", hrs: 3, reason: "Debrief" },
		{ day: "Sat", hrs: 0, reason: "" },
		{ day: "Sun", hrs: 0, reason: "" },
	],
	mgr: [
		{ day: "Mon", hrs: 2, reason: "Equipment setup" },
		{ day: "Tue", hrs: 2, reason: "Equipment setup" },
		{ day: "Wed", hrs: 2, reason: "Logistics run" },
		{ day: "Thu", hrs: 0, reason: "" },
		{ day: "Fri", hrs: 2, reason: "Inventory check" },
		{ day: "Sat", hrs: 0, reason: "" },
		{ day: "Sun", hrs: 0, reason: "" },
	],
};

function posTotal(id: string): number {
	return POS_DAILY[id].reduce((s, d) => s + d.hrs, 0);
}

const MEMBERS = [
	{ id: "daniel", name: "Daniel", color: "#3b82f6", position: "swimmer" },
	{ id: "wayne", name: "Wayne", color: "#a855f7", position: "swimmer" },
	{ id: "raegan", name: "Raegan", color: "#22c55e", position: "mgr" },
] as const;

const MEM_DAILY: Record<string, DayEntry[]> = {
	daniel: [
		{ day: "Mon", hrs: 3, reason: "Training session" },
		{ day: "Tue", hrs: 3, reason: "Training session" },
		{ day: "Wed", hrs: 3, reason: "Competition prep" },
		{ day: "Thu", hrs: 3, reason: "Competition prep" },
		{ day: "Fri", hrs: 3, reason: "Debrief" },
		{ day: "Sat", hrs: 0, reason: "" },
		{ day: "Sun", hrs: 0, reason: "" },
	],
	wayne: [
		{ day: "Mon", hrs: 3, reason: "Training session" },
		{ day: "Tue", hrs: 0, reason: "Reduced - sick leave, did not attend" },
		{ day: "Wed", hrs: 3, reason: "Competition prep" },
		{ day: "Thu", hrs: 0, reason: "Reduced - personal matter, did not attend" },
		{ day: "Fri", hrs: 2, reason: "Reduced 1h - left early for appointment" },
		{ day: "Sat", hrs: 0, reason: "" },
		{ day: "Sun", hrs: 0, reason: "" },
	],
	raegan: [
		{ day: "Mon", hrs: 2, reason: "Equipment setup" },
		{ day: "Tue", hrs: 2, reason: "Equipment setup" },
		{ day: "Wed", hrs: 2, reason: "Logistics run" },
		{ day: "Thu", hrs: 3, reason: "Added 1h - helped with admin duties" },
		{ day: "Fri", hrs: 3, reason: "Added 1h - covered for Wayne's absence" },
		{ day: "Sat", hrs: 0, reason: "" },
		{ day: "Sun", hrs: 0, reason: "" },
	],
};

function memTotal(id: string): number {
	return MEM_DAILY[id].reduce((s, d) => s + d.hrs, 0);
}

type MemberStatus = "normal" | "up" | "down";

function memStatus(id: string): MemberStatus {
	const pos = MEMBERS.find((m) => m.id === id)!.position;
	const pTotal = posTotal(pos);
	const mTotal = memTotal(id);
	if (mTotal < pTotal) return "down";
	if (mTotal > pTotal) return "up";
	return "normal";
}

const RATE = 6;
function subsidy(id: string): string {
	return `$${memTotal(id) * RATE}`;
}

const STEPS: Step[] = [
	{
		phase: "setup",
		highlight: "all",
		description:
			"This is Swim Team.\nAlexis is the vice captain. She has 2 positions and 3 members.\nAlexis is the one who submits holiday subsidy for everyone.",
	},
	{
		phase: "overview",
		highlight: "chair",
		description:
			"Alexis needs to do 2 things:\n  1. Declare how many hours each position worked, for each day, with a reason.\n  2. Declare how many hours each member worked, for each day, with a reason.\nShe must do step 1 first. Step 2 is locked until step 1 is approved.",
	},
	{
		phase: "pos-decl",
		highlight: "positions",
		showPosHours: true,
		description:
			"Step 1 - Position Subsidy\nFor each position, Alexis fills in the hours for every day\nand writes a reason for each entry.\nClick a position to see the daily breakdown.",
	},
	{
		phase: "pos-approve",
		highlight: "positions",
		badge: "JCRC approved the position hours",
		showPosHours: true,
		description:
			"JCRC checks Alexis's numbers and approves them.\nThis doesn't give anyone money yet - it just autofills\nthe hours for the next step (member declarations).",
	},
	{
		phase: "appt-locked",
		highlight: "members",
		showLocked: true,
		description:
			"Step 2 - Member Subsidy\nThis was locked until JCRC approved step 1.\nNow Alexis declares how many hours each member actually worked -\nagain, for each day, with a reason.",
	},
	{
		phase: "appt-decl",
		highlight: "members",
		showMemberDecl: true,
		description:
			"By default, every member starts at 0 hours.\nAlexis fills in each day for each person.\nWayne missed 2 days (sick, personal) and left early once - reduced hours, with reason.\nRaegan did extra work Thu and Fri (admin duties, covered for Wayne) - added hours, with reason.\nEvery change needs a reason.",
	},
	{
		phase: "appt-approve",
		highlight: "members",
		badge: "JCRC approved the member hours",
		showMemberDecl: true,
		description:
			"JCRC reviews Alexis's member declarations and approves.\nBoth steps are now done. The numbers are locked in.",
	},
	{
		phase: "missed",
		highlight: "none",
		showMissed: true,
		description:
			"What happens if Alexis doesn't submit anything?\nEvery member gets 0 hours. No declaration = no money.\nIt's the chair/vice's job. If they forget, nobody gets paid.",
	},
	{
		phase: "calc",
		highlight: "none",
		showTotals: true,
		description:
			"Sheares Web takes all the approved hours and calculates\nhow much money each member gets.",
	},
	{
		phase: "summary",
		highlight: "all",
		showTotals: true,
		description:
			"That's it. Here's the whole process:\n• Chair/Vice declares hours per position, per day, with reasons (step 1).\n• JCRC approves. This unlocks step 2.\n• Chair/Vice declares hours per member, per day, with reasons (step 2). Default is 0.\n• JCRC approves again. Done.\n• If the chair/vice doesn't submit - everyone gets nothing.",
	},
];

// --- SVG layout ---
const SVG_W = 700;
const CHAIR_X = SVG_W / 2;
const CHAIR_Y = 30;
const CCA_Y = 85;
const POS_Y = 160;
const MEM_Y = 240;
const POS_XS = [SVG_W * 0.3, SVG_W * 0.7];

const MEM_POS_MAP: Record<string, number> = { daniel: 0, wayne: 0, raegan: 1 };
const MEM_IDX_MAP: Record<string, number> = { daniel: 0, wayne: 1, raegan: 0 };

function getMemberX(memId: string): number {
	const posIdx = MEM_POS_MAP[memId];
	const memIdx = MEM_IDX_MAP[memId];
	const count = memId === "raegan" ? 1 : 2;
	if (count === 1) return POS_XS[posIdx];
	return POS_XS[posIdx] + (memIdx === 0 ? -52 : 52);
}

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
	const midY = (y1 + y2) / 2;
	return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

function statusColor(s?: string) {
	if (s === "down") return "text-red-400";
	if (s === "up") return "text-emerald-400";
	return "text-slate-300";
}

function DayBreakdown({ days, accentColor }: { days: DayEntry[]; accentColor: string }) {
	return (
		<div className="border-t border-slate-800/40 px-4 py-2 animate-[fade-up_0.2s_ease-out_both]">
			{days.map((d) => (
				<div key={d.day} className="flex items-center py-1.5 gap-3">
					<span className="text-[11px] font-mono text-slate-500 w-8 shrink-0">{d.day}</span>
					{d.hrs > 0 ? (
						<>
							<span
								className={cn("text-sm font-bold font-mono w-6 text-right shrink-0", accentColor)}
							>
								{d.hrs}h
							</span>
							<span className="text-[11px] text-slate-400 min-w-0 truncate">{d.reason}</span>
						</>
					) : (
						<span className="text-[11px] text-slate-700">&ndash; {d.reason || "No activity"}</span>
					)}
				</div>
			))}
		</div>
	);
}

export function SubsidyFlowVisual() {
	const [step, setStep] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const { ref, isInView } = useInView(0.1);
	const [hasStarted, setHasStarted] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

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
		const delay = current.phase === "setup" ? 6000 : current.phase === "summary" ? 7000 : 5500;
		const timer = setTimeout(() => {
			if (step < STEPS.length - 1) setStep((s) => s + 1);
			else setIsPlaying(false);
		}, delay);
		return () => clearTimeout(timer);
	}, [step, isPlaying, current.phase]);

	useEffect(() => {
		setExpandedId(null);
	}, [step]);

	const phaseStyles: Record<string, { label: string; style: string }> = {
		setup: { label: "Setup", style: "bg-blue-500/15 text-blue-400" },
		overview: { label: "Overview", style: "bg-blue-500/15 text-blue-400" },
		"pos-decl": { label: "Step 1", style: "bg-orange-500/15 text-orange-400" },
		"pos-approve": { label: "Approved", style: "bg-emerald-500/15 text-emerald-400" },
		"appt-locked": { label: "Step 2", style: "bg-purple-500/15 text-purple-400" },
		"appt-decl": { label: "Step 2", style: "bg-purple-500/15 text-purple-400" },
		"appt-approve": { label: "Approved", style: "bg-emerald-500/15 text-emerald-400" },
		missed: { label: "Not Declared", style: "bg-red-500/15 text-red-400" },
		calc: { label: "Calculation", style: "bg-purple-500/15 text-purple-400" },
		summary: { label: "Summary", style: "bg-blue-500/15 text-blue-400" },
	};

	const ps = phaseStyles[current.phase];
	const hlChair = current.highlight === "chair" || current.highlight === "all";
	const hlPos = current.highlight === "positions" || current.highlight === "all";
	const hlMem = current.highlight === "members" || current.highlight === "all";

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
					How Holiday Subsidy Works
				</h3>
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
							ps.style,
						)}
					>
						{ps.label}
					</span>
					<span className="text-slate-500 text-xs font-mono tabular-nums">
						{step + 1}/{STEPS.length}
					</span>
				</div>
			</div>

			{/* Badge */}
			{current.badge && (
				<div
					key={`badge-${step}`}
					className="flex items-center justify-center mb-3 animate-[fade-in-scale_0.5s_ease-out_both]"
				>
					<div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
						<span className="text-emerald-400 text-[10px]">&#10003;</span>
						<span className="text-emerald-400 text-xs font-medium">{current.badge}</span>
					</div>
				</div>
			)}

			{/* SVG Tree */}
			<svg
				viewBox={`0 0 ${SVG_W} 280`}
				className="w-full mb-2"
				role="img"
				aria-label="CCA structure"
			>
				{/* Curved connectors */}
				<path
					d={curvePath(CHAIR_X, CHAIR_Y + 16, CHAIR_X, CCA_Y - 16)}
					fill="none"
					stroke={hlChair ? "rgba(251,146,60,0.5)" : "rgba(148,163,184,0.12)"}
					strokeWidth={1.5}
					className="transition-all duration-500"
				/>

				{POS_XS.map((px, i) => (
					<path
						key={`cca-pos-${i}`}
						d={curvePath(CHAIR_X, CCA_Y + 16, px, POS_Y - 16)}
						fill="none"
						stroke={hlPos ? "rgba(251,146,60,0.45)" : "rgba(148,163,184,0.1)"}
						strokeWidth={1.5}
						className="transition-all duration-500"
					/>
				))}

				{MEMBERS.map((mem) => {
					const mx = getMemberX(mem.id);
					const posIdx = MEM_POS_MAP[mem.id];
					const st = memStatus(mem.id);
					const active = hlMem && current.highlight === "members";
					const lineColor = active
						? st === "down"
							? "rgba(239,68,68,0.5)"
							: st === "up"
								? "rgba(34,197,94,0.5)"
								: `${mem.color}50`
						: hlMem
							? `${mem.color}30`
							: "rgba(148,163,184,0.1)";
					return (
						<path
							key={`pos-mem-${mem.id}`}
							d={curvePath(POS_XS[posIdx], POS_Y + 16, mx, MEM_Y - 16)}
							fill="none"
							stroke={lineColor}
							strokeWidth={1.5}
							className="transition-all duration-500"
						/>
					);
				})}

				{/* Alice (chair) */}
				{hlChair && (
					<circle
						cx={CHAIR_X}
						cy={CHAIR_Y}
						r={20}
						fill="#fb923c"
						opacity={0.06}
						className="animate-[node-pulse_2s_ease-in-out_infinite]"
					/>
				)}
				<circle
					cx={CHAIR_X}
					cy={CHAIR_Y}
					r={15}
					fill="rgba(15,23,42,0.95)"
					stroke={hlChair ? "#fb923c" : "rgba(148,163,184,0.15)"}
					strokeWidth={1.5}
					className="transition-all duration-500"
				/>
				<text
					x={CHAIR_X}
					y={CHAIR_Y + 1}
					textAnchor="middle"
					dominantBaseline="central"
					fill={hlChair ? "#fb923c" : "rgba(148,163,184,0.3)"}
					fontSize="11"
					fontWeight="700"
					className="transition-all duration-500"
				>
					A
				</text>
				<text
					x={CHAIR_X}
					y={CHAIR_Y - 22}
					textAnchor="middle"
					fill={hlChair ? "rgba(251,146,60,0.7)" : "rgba(148,163,184,0.3)"}
					fontSize="9"
					fontWeight="600"
					className="transition-all duration-500"
				>
					Alexis (Vice Captain)
				</text>

				{/* CCA node */}
				<rect
					x={CHAIR_X - 58}
					y={CCA_Y - 15}
					width={116}
					height={30}
					rx={15}
					fill="rgba(15,23,42,0.95)"
					stroke="#fb923c"
					strokeWidth={1.5}
				/>
				<text
					x={CHAIR_X}
					y={CCA_Y + 1}
					textAnchor="middle"
					dominantBaseline="central"
					fill="#fb923c"
					fontSize="12"
					fontWeight="700"
				>
					Swim Team
				</text>

				{/* Position nodes */}
				{POSITIONS.map((pos, pi) => {
					const px = POS_XS[pi];
					const w = Math.max(pos.label.length * 7 + 28, 120);
					return (
						<g key={pos.id}>
							{hlPos && (
								<rect
									x={px - w / 2 - 3}
									y={POS_Y - 17}
									width={w + 6}
									height={34}
									rx={8}
									fill="#fb923c"
									opacity={0.06}
									className="animate-[node-pulse_2s_ease-in-out_infinite]"
								/>
							)}
							<rect
								x={px - w / 2}
								y={POS_Y - 15}
								width={w}
								height={30}
								rx={7}
								fill="rgba(15,23,42,0.95)"
								stroke={hlPos ? "rgba(251,146,60,0.6)" : "rgba(148,163,184,0.15)"}
								strokeWidth={1.5}
								className="transition-all duration-500"
							/>
							<text
								x={px}
								y={POS_Y + 1}
								textAnchor="middle"
								dominantBaseline="central"
								fill={hlPos ? "rgba(251,146,60,0.9)" : "rgba(226,232,240,0.5)"}
								fontSize="11"
								fontWeight="600"
								className="transition-all duration-500"
							>
								{pos.label}
							</text>
						</g>
					);
				})}

				{/* Member nodes */}
				{MEMBERS.map((mem) => {
					const mx = getMemberX(mem.id);
					const active = hlMem && current.highlight === "members";
					const st = memStatus(mem.id);
					const ringColor = active
						? st === "down"
							? "#ef4444"
							: st === "up"
								? "#22c55e"
								: mem.color
						: mem.color;
					return (
						<g key={mem.id}>
							{active && (
								<circle
									cx={mx}
									cy={MEM_Y}
									r={20}
									fill={ringColor}
									opacity={0.08}
									className="animate-[node-pulse_2s_ease-in-out_infinite]"
								/>
							)}
							<circle
								cx={mx}
								cy={MEM_Y}
								r={15}
								fill="rgba(15,23,42,0.95)"
								stroke={hlMem ? ringColor : "rgba(148,163,184,0.15)"}
								strokeWidth={1.5}
								opacity={hlMem ? 1 : 0.5}
								className="transition-all duration-500"
							/>
							<text
								x={mx}
								y={MEM_Y + 1}
								textAnchor="middle"
								dominantBaseline="central"
								fill={hlMem ? ringColor : "rgba(148,163,184,0.3)"}
								fontSize="11"
								fontWeight="700"
								className="transition-all duration-500"
							>
								{mem.name[0]}
							</text>
							<text
								x={mx}
								y={MEM_Y + 28}
								textAnchor="middle"
								fill={hlMem ? "rgba(226,232,240,0.8)" : "rgba(148,163,184,0.3)"}
								fontSize="9"
								fontWeight="600"
								className="transition-all duration-500"
							>
								{mem.name}
							</text>
						</g>
					);
				})}
			</svg>

			{/* Position Hours - per day with reasons, expandable */}
			{current.showPosHours && (
				<div
					key={`pos-hrs-${step}`}
					className="mb-3 flex flex-col gap-2 animate-[fade-up_0.4s_ease-out_both]"
				>
					{POSITIONS.map((pos) => {
						const total = posTotal(pos.id);
						const isOpen = expandedId === `pos-${pos.id}`;
						return (
							<div
								key={pos.id}
								className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] overflow-hidden"
							>
								<button
									onClick={() => {
										setIsPlaying(false);
										setExpandedId(isOpen ? null : `pos-${pos.id}`);
									}}
									className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-500/[0.03] transition-colors"
								>
									<div className="flex-1 text-left">
										<p className="text-sm font-medium text-orange-400">{pos.label}</p>
										<p className="text-[11px] text-slate-500">Tap to see daily breakdown</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-2xl font-bold font-mono text-orange-400">{total}</span>
										<span className="text-xs text-slate-500">hrs</span>
									</div>
									<ChevronDown
										className={cn(
											"size-4 text-slate-500 transition-transform duration-200",
											isOpen && "rotate-180",
										)}
									/>
								</button>
								{isOpen && <DayBreakdown days={POS_DAILY[pos.id]} accentColor="text-orange-400" />}
							</div>
						);
					})}
					<p className="text-[11px] text-slate-600 text-center">
						For each position, Alexis fills in the hours and reason for every day.
					</p>
				</div>
			)}

			{/* Locked state */}
			{current.showLocked && (
				<div
					key="locked"
					className="mb-3 rounded-lg border border-purple-500/20 bg-purple-500/[0.03] p-4 animate-[fade-up_0.4s_ease-out_both]"
				>
					<div className="flex items-center justify-center gap-3 flex-wrap">
						<div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
							<span className="text-emerald-400 text-xs">&#10003;</span>
							<span className="text-emerald-400 text-[11px] font-medium">Step 1 approved</span>
						</div>
						<span className="text-slate-600 text-lg">&rarr;</span>
						<div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
							<span className="text-purple-400 text-[11px] font-medium">
								Step 2 is now unlocked
							</span>
						</div>
					</div>
					<p className="text-[11px] text-slate-500 text-center mt-2">
						You can&apos;t do step 2 until JCRC approves step 1.
					</p>
				</div>
			)}

			{/* Per-Member daily declarations, expandable */}
			{current.showMemberDecl && (
				<div key={`mem-${step}`} className="mb-3 animate-[fade-up_0.4s_ease-out_both]">
					<p className="text-[10px] uppercase tracking-widest text-purple-400/60 font-semibold mb-2 text-center">
						Each member starts at 0h - chair must declare every day
					</p>
					<div className="flex flex-col gap-2">
						{MEMBERS.map((mem) => {
							const total = memTotal(mem.id);
							const pTotal = posTotal(mem.position);
							const st = memStatus(mem.id);
							const diff = total - pTotal;
							const isOpen = expandedId === `mem-${mem.id}`;

							const borderCn =
								st === "down"
									? "border-red-500/25"
									: st === "up"
										? "border-emerald-500/25"
										: "border-purple-500/20";
							const bgCn =
								st === "down"
									? "bg-red-500/[0.04]"
									: st === "up"
										? "bg-emerald-500/[0.04]"
										: "bg-purple-500/[0.03]";
							const accentCn =
								st === "down"
									? "text-red-400"
									: st === "up"
										? "text-emerald-400"
										: "text-purple-400";

							return (
								<div
									key={mem.id}
									className={cn("rounded-lg border overflow-hidden", borderCn, bgCn)}
								>
									<button
										onClick={() => {
											setIsPlaying(false);
											setExpandedId(isOpen ? null : `mem-${mem.id}`);
										}}
										className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors"
									>
										<span
											className="size-2.5 rounded-full shrink-0"
											style={{ background: mem.color }}
										/>
										<div className="flex-1 text-left">
											<p className="text-sm font-medium text-slate-300">{mem.name}</p>
											<p className="text-[11px] text-slate-500">
												{POSITIONS.find((p) => p.id === mem.position)?.label} · Position: {pTotal}h
											</p>
										</div>
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] text-slate-600 line-through">0h</span>
											<span className="text-slate-700">&rarr;</span>
											<span className={cn("text-2xl font-bold font-mono", accentCn)}>{total}</span>
											<span className="text-xs text-slate-500">hrs</span>
											{diff !== 0 && (
												<span
													className={cn(
														"text-[10px] font-semibold",
														diff > 0 ? "text-emerald-500" : "text-red-500",
													)}
												>
													{diff > 0 ? `+${diff}` : diff} vs position
												</span>
											)}
										</div>
										<ChevronDown
											className={cn(
												"size-4 text-slate-500 transition-transform duration-200",
												isOpen && "rotate-180",
											)}
										/>
									</button>
									{isOpen && <DayBreakdown days={MEM_DAILY[mem.id]} accentColor={accentCn} />}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Missed state */}
			{current.showMissed && (
				<div
					key="missed"
					className="mb-3 rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 animate-[fade-up_0.4s_ease-out_both]"
				>
					<div className="flex items-center justify-center gap-3 mb-2">
						<div className="size-10 rounded-full border-2 border-dashed border-red-500/40 flex items-center justify-center">
							<span className="text-red-400 text-lg">&times;</span>
						</div>
						<div>
							<p className="text-red-400 text-sm font-semibold">
								Chair didn&apos;t submit anything
							</p>
							<p className="text-red-400/50 text-xs">Every single member gets $0.</p>
						</div>
					</div>
				</div>
			)}

			{/* Totals */}
			{current.showTotals && (
				<div key={`totals-${step}`} className="mb-3 animate-[fade-up_0.4s_ease-out_both]">
					<div className="grid grid-cols-3 gap-2">
						{MEMBERS.map((mem) => {
							const total = memTotal(mem.id);
							const st = memStatus(mem.id);
							return (
								<div
									key={mem.id}
									className={cn(
										"rounded-lg border p-3 text-center",
										st === "down"
											? "border-red-500/20 bg-red-500/5"
											: st === "up"
												? "border-emerald-500/20 bg-emerald-500/5"
												: "border-slate-800/40 bg-slate-900/30",
									)}
								>
									<div className="flex items-center justify-center gap-1.5 mb-1">
										<span className="size-2 rounded-full" style={{ background: mem.color }} />
										<span className="text-xs font-medium text-slate-300">{mem.name}</span>
									</div>
									<p className={cn("text-xl font-bold", statusColor(st))}>{subsidy(mem.id)}</p>
									<p className="text-[10px] text-slate-600">{total}h approved</p>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Description */}
			<div className="min-h-[80px] flex items-start justify-center px-2 mt-1">
				<div key={step} className="animate-[fade-up_0.4s_ease-out_both] max-w-lg w-full">
					{current.description.split("\n").map((line, i) => (
						<p
							key={i}
							className={cn(
								"text-sm leading-relaxed",
								line.startsWith("•")
									? "text-slate-400 pl-3"
									: line.startsWith("  ")
										? "text-slate-400 pl-4"
										: "text-slate-300",
							)}
						>
							{line}
						</p>
					))}
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center justify-center gap-2 mt-3">
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
