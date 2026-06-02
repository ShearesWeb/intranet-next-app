"use client";

import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

type Phase =
	| "intro"
	| "auto-1"
	| "auto-2"
	| "contest"
	| "conflict"
	| "negotiate"
	| "yield"
	| "no-yield"
	| "jcrc"
	| "summary";

interface Step {
	phase: Phase;
	description: string;
	badge?: string;
}

const STEPS: Step[] = [
	{
		phase: "intro",
		description:
			"Sheares venues are uploaded by admin as bookable slots.\nCCA chairs browse the calendar and claim slots for their CCA.\nIf nobody else wants it, you get it instantly.",
	},
	{
		phase: "auto-1",
		badge: "Auto-approved",
		description:
			"Swim Team claims Mon 7–9pm at the Seminar Room.\nNo other CCA has claimed this slot — so it's auto-approved.\nThis is the default: claim it, it's yours.",
	},
	{
		phase: "auto-2",
		badge: "Auto-approved",
		description:
			"Dance claims Tue 7–9pm — also no competition.\nAuto-approved. Most bookings end here.\nConflicts only happen when two CCAs want the same slot.",
	},
	{
		phase: "contest",
		description:
			"Band also wants Mon 7–9pm — the slot Swim already booked.\nBand clicks 'Contest' to challenge the booking.\nSwim's approval is revoked — both claims are now in conflict.",
	},
	{
		phase: "conflict",
		badge: "Conflict detected",
		description:
			"Neither CCA has the slot confirmed anymore.\nBoth chairs are notified and can see each other's contact info\non the Conflicts page. They need to work it out.",
	},
	{
		phase: "negotiate",
		description:
			"The two chairs discuss who needs the room more.\nOne of them can yield (give up their claim).\nIf they can't agree, JCRC will step in.",
	},
	{
		phase: "yield",
		badge: "Band yielded",
		description:
			"Band decides to yield — they'll find another slot.\nSwim's claim is re-approved. Conflict resolved.\nThis is the happy path: chairs sort it out themselves.",
	},
	{
		phase: "no-yield",
		description:
			"But what if nobody yields?\nThe conflict stays open. After a while, it escalates.\nJCRC admin gets involved to make the final call.",
	},
	{
		phase: "jcrc",
		badge: "JCRC resolved",
		description:
			"JCRC reviews both claims and picks one.\nThe other claim is rejected. The decision is final.\nChairs can avoid this by negotiating early.",
	},
	{
		phase: "summary",
		description:
			"That's the whole flow:\n• Claim a slot → auto-approved if nobody else wants it.\n• Another CCA contests → both enter conflict.\n• Chairs negotiate — one yields, conflict resolved.\n• Nobody yields → JCRC makes the call.",
	},
];

const CCAS = [
	{ id: "swim", name: "Swim Team", abbr: "S", color: "#f97316" },
	{ id: "band", name: "Band", abbr: "B", color: "#3b82f6" },
	{ id: "dance", name: "Dance", abbr: "D", color: "#a855f7" },
] as const;

const SVG_W = 700;
const SVG_H = 300;

const SLOT_X = SVG_W / 2;
const SLOT_MON_Y = 100;
const SLOT_TUE_Y = 200;

const CCA_X = SVG_W - 100;
const CCA_YS = [70, 150, 230];

const CAL_X = 100;
const CAL_Y = SVG_H / 2;

const JCRC_X = SLOT_X;
const JCRC_Y = SVG_H - 30;

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
	const mx = (x1 + x2) / 2;
	return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

type SlotState = "available" | "claimed" | "conflict" | "approved";
type CcaLinkState = "none" | "claiming" | "approved" | "conflict" | "yielded" | "rejected";

interface SlotVisual {
	id: string;
	label: string;
	day: string;
	time: string;
	y: number;
	state: SlotState;
}

interface CcaLink {
	ccaId: string;
	slotId: string;
	state: CcaLinkState;
}

function getStepState(phase: Phase): { slots: SlotVisual[]; links: CcaLink[]; showJcrc: boolean } {
	const mon: SlotVisual = {
		id: "mon",
		label: "Seminar Room",
		day: "Mon",
		time: "7–9pm",
		y: SLOT_MON_Y,
		state: "available",
	};
	const tue: SlotVisual = {
		id: "tue",
		label: "Seminar Room",
		day: "Tue",
		time: "7–9pm",
		y: SLOT_TUE_Y,
		state: "available",
	};

	switch (phase) {
		case "intro":
			return { slots: [mon, tue], links: [], showJcrc: false };
		case "auto-1":
			return {
				slots: [{ ...mon, state: "approved" }, tue],
				links: [{ ccaId: "swim", slotId: "mon", state: "approved" }],
				showJcrc: false,
			};
		case "auto-2":
			return {
				slots: [
					{ ...mon, state: "approved" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "approved" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
		case "contest":
			return {
				slots: [
					{ ...mon, state: "conflict" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "conflict" },
					{ ccaId: "band", slotId: "mon", state: "claiming" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
		case "conflict":
		case "negotiate":
			return {
				slots: [
					{ ...mon, state: "conflict" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "conflict" },
					{ ccaId: "band", slotId: "mon", state: "conflict" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
		case "yield":
			return {
				slots: [
					{ ...mon, state: "approved" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "approved" },
					{ ccaId: "band", slotId: "mon", state: "yielded" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
		case "no-yield":
			return {
				slots: [
					{ ...mon, state: "conflict" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "conflict" },
					{ ccaId: "band", slotId: "mon", state: "conflict" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
		case "jcrc":
			return {
				slots: [
					{ ...mon, state: "approved" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "approved" },
					{ ccaId: "band", slotId: "mon", state: "rejected" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: true,
			};
		case "summary":
			return {
				slots: [
					{ ...mon, state: "approved" },
					{ ...tue, state: "approved" },
				],
				links: [
					{ ccaId: "swim", slotId: "mon", state: "approved" },
					{ ccaId: "band", slotId: "mon", state: "rejected" },
					{ ccaId: "dance", slotId: "tue", state: "approved" },
				],
				showJcrc: false,
			};
	}
}

function linkColor(state: CcaLinkState, ccaColor: string): string {
	switch (state) {
		case "claiming":
			return ccaColor;
		case "conflict":
			return "#f87171";
		case "approved":
			return "#22c55e";
		case "yielded":
			return "#94a3b8";
		case "rejected":
			return "#94a3b8";
		default:
			return "transparent";
	}
}

function slotBorderColor(state: SlotState): string {
	switch (state) {
		case "available":
			return "rgba(148,163,184,0.3)";
		case "claimed":
			return "#fbbf24";
		case "conflict":
			return "#f87171";
		case "approved":
			return "#22c55e";
	}
}

export function BookingFlowVisual() {
	const [step, setStep] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const { ref, isInView } = useInView(0.1);
	const [hasStarted, setHasStarted] = useState(false);

	const current = STEPS[step];
	const isFinished = step === STEPS.length - 1;
	const { slots, links, showJcrc } = getStepState(current.phase);

	useEffect(() => {
		if (isInView && !hasStarted) {
			setHasStarted(true);
			const t = setTimeout(() => setIsPlaying(true), 800);
			return () => clearTimeout(t);
		}
	}, [isInView, hasStarted]);

	useEffect(() => {
		if (!isPlaying) return;
		const delay = current.phase === "intro" ? 6000 : current.phase === "summary" ? 7000 : 5000;
		const timer = setTimeout(() => {
			if (step < STEPS.length - 1) setStep((s) => s + 1);
			else setIsPlaying(false);
		}, delay);
		return () => clearTimeout(timer);
	}, [step, isPlaying, current.phase]);

	const phaseStyles: Record<string, { label: string; style: string }> = {
		intro: { label: "Overview", style: "bg-blue-500/15 text-blue-400" },
		"auto-1": { label: "Auto-approved", style: "bg-emerald-500/15 text-emerald-400" },
		"auto-2": { label: "Auto-approved", style: "bg-emerald-500/15 text-emerald-400" },
		contest: { label: "Contested", style: "bg-orange-500/15 text-orange-400" },
		conflict: { label: "Conflict", style: "bg-red-500/15 text-red-400" },
		negotiate: { label: "Negotiate", style: "bg-yellow-500/15 text-yellow-400" },
		yield: { label: "Resolved", style: "bg-emerald-500/15 text-emerald-400" },
		"no-yield": { label: "Escalated", style: "bg-red-500/15 text-red-400" },
		jcrc: { label: "JCRC", style: "bg-purple-500/15 text-purple-400" },
		summary: { label: "Summary", style: "bg-blue-500/15 text-blue-400" },
	};

	const ps = phaseStyles[current.phase];
	const isNegotiating = current.phase === "negotiate";

	const monHighlighted = slots.some((s) => s.id === "mon" && s.state !== "available");
	const tueHighlighted = slots.some((s) => s.id === "tue" && s.state !== "available");

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
					How Facilities Booking Works
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

			{/* Legend */}
			<div className="flex items-center justify-center gap-4 mb-2 flex-wrap">
				{[
					{ color: "#22c55e", label: "Approved" },
					{ color: "#f87171", label: "Conflict" },
					{ color: "#fbbf24", label: "Contesting" },
					{ color: "#94a3b8", label: "Yielded / Rejected" },
				].map(({ color, label }) => (
					<span key={label} className="flex items-center gap-1.5 text-[11px]">
						<span className="size-2 rounded-full" style={{ background: color }} />
						<span className="text-slate-500">{label}</span>
					</span>
				))}
			</div>

			{/* Badge */}
			{current.badge && (
				<div
					key={`badge-${step}`}
					className="flex items-center justify-center mb-3 animate-[fade-in-scale_0.5s_ease-out_both]"
				>
					<div
						className={cn(
							"flex items-center gap-1.5 px-3 py-1 rounded-full border",
							current.phase === "conflict"
								? "bg-red-500/10 border-red-500/20"
								: current.phase === "jcrc"
									? "bg-purple-500/10 border-purple-500/20"
									: "bg-emerald-500/10 border-emerald-500/20",
						)}
					>
						<span
							className={cn(
								"text-[10px]",
								current.phase === "conflict"
									? "text-red-400"
									: current.phase === "jcrc"
										? "text-purple-400"
										: "text-emerald-400",
							)}
						>
							{current.phase === "conflict" ? "⚠" : "✓"}
						</span>
						<span
							className={cn(
								"text-xs font-medium",
								current.phase === "conflict"
									? "text-red-400"
									: current.phase === "jcrc"
										? "text-purple-400"
										: "text-emerald-400",
							)}
						>
							{current.badge}
						</span>
					</div>
				</div>
			)}

			{/* SVG */}
			<svg
				viewBox={`0 0 ${SVG_W} ${SVG_H}`}
				className="w-full"
				role="img"
				aria-label="Facilities booking flow animation"
			>
				<defs>
					<filter id="fbSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="8" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				{/* Column labels */}
				<text
					x={CAL_X}
					y={22}
					textAnchor="middle"
					fill="rgba(148,163,184,0.5)"
					fontSize="10"
					fontWeight="600"
					letterSpacing="0.1em"
				>
					CALENDAR
				</text>
				<text
					x={SLOT_X}
					y={22}
					textAnchor="middle"
					fill="rgba(148,163,184,0.5)"
					fontSize="10"
					fontWeight="600"
					letterSpacing="0.1em"
				>
					VENUE SLOTS
				</text>
				<text
					x={CCA_X}
					y={22}
					textAnchor="middle"
					fill="rgba(148,163,184,0.5)"
					fontSize="10"
					fontWeight="600"
					letterSpacing="0.1em"
				>
					CCAs
				</text>

				{/* Calendar */}
				<g>
					<rect
						x={CAL_X - 40}
						y={CAL_Y - 50}
						width={80}
						height={100}
						rx={8}
						fill="rgba(15,23,42,0.95)"
						stroke="rgba(148,163,184,0.2)"
						strokeWidth={1.5}
					/>
					<rect
						x={CAL_X - 40}
						y={CAL_Y - 50}
						width={80}
						height={24}
						rx={8}
						fill="rgba(251,146,60,0.1)"
						stroke="rgba(251,146,60,0.3)"
						strokeWidth={1.5}
					/>
					<text
						x={CAL_X}
						y={CAL_Y - 34}
						textAnchor="middle"
						dominantBaseline="central"
						fill="#fb923c"
						fontSize="10"
						fontWeight="700"
					>
						JUNE
					</text>

					{[
						{ label: "M", x: -24, highlighted: monHighlighted },
						{ label: "T", x: -8, highlighted: tueHighlighted },
						{ label: "W", x: 8, highlighted: false },
						{ label: "T", x: 24, highlighted: false },
					].map((day, i) => (
						<g key={i}>
							<text
								x={CAL_X + day.x}
								y={CAL_Y - 12}
								textAnchor="middle"
								fill="rgba(148,163,184,0.4)"
								fontSize="8"
								fontWeight="600"
							>
								{day.label}
							</text>
							<rect
								x={CAL_X + day.x - 8}
								y={CAL_Y - 4}
								width={16}
								height={16}
								rx={3}
								fill={day.highlighted ? "rgba(251,146,60,0.15)" : "rgba(15,23,42,0.5)"}
								stroke={day.highlighted ? "rgba(251,146,60,0.4)" : "rgba(148,163,184,0.1)"}
								strokeWidth={1}
								className="transition-all duration-500"
							/>
							<text
								x={CAL_X + day.x}
								y={CAL_Y + 5}
								textAnchor="middle"
								dominantBaseline="central"
								fill={day.highlighted ? "#fb923c" : "rgba(148,163,184,0.3)"}
								fontSize="9"
								className="transition-all duration-500"
							>
								{i + 2}
							</text>
						</g>
					))}

					{[5, 6, 7, 8].map((d, i) => (
						<g key={`r2-${i}`}>
							<rect
								x={CAL_X + (i * 16 - 24) - 8}
								y={CAL_Y + 18}
								width={16}
								height={16}
								rx={3}
								fill="rgba(15,23,42,0.5)"
								stroke="rgba(148,163,184,0.06)"
								strokeWidth={1}
							/>
							<text
								x={CAL_X + (i * 16 - 24)}
								y={CAL_Y + 27}
								textAnchor="middle"
								dominantBaseline="central"
								fill="rgba(148,163,184,0.2)"
								fontSize="9"
							>
								{d + 2}
							</text>
						</g>
					))}
				</g>

				{/* Calendar → Slot dashed lines */}
				{slots.map((slot) => (
					<path
						key={`cal-${slot.id}`}
						d={curvePath(
							CAL_X + 40,
							slot.id === "mon" ? CAL_Y - 4 : CAL_Y + 18,
							SLOT_X - 80,
							slot.y,
						)}
						fill="none"
						stroke={slotBorderColor(slot.state)}
						strokeWidth={1}
						strokeDasharray="4 4"
						opacity={0.3}
						className="transition-all duration-500"
					/>
				))}

				{/* CCA → Slot lines */}
				{links.map((link) => {
					const cca = CCAS.find((c) => c.id === link.ccaId)!;
					const slot = slots.find((s) => s.id === link.slotId);
					if (!slot) return null;
					const ci = CCAS.indexOf(cca);
					const cy = CCA_YS[ci];
					const color = linkColor(link.state, cca.color);
					const isActive = link.state === "claiming" || link.state === "conflict";
					const isDead = link.state === "yielded" || link.state === "rejected";
					const isApproved = link.state === "approved";

					return (
						<g key={`${link.ccaId}-${link.slotId}`}>
							{isApproved && (
								<path
									d={curvePath(SLOT_X + 80, slot.y, CCA_X - 28, cy)}
									stroke="#22c55e"
									strokeWidth={5}
									fill="none"
									opacity={0.12}
									filter="url(#fbSoftGlow)"
									className="transition-all duration-700"
								/>
							)}
							{isActive && (
								<path
									d={curvePath(SLOT_X + 80, slot.y, CCA_X - 28, cy)}
									stroke={color}
									strokeWidth={4}
									fill="none"
									opacity={0.12}
									filter="url(#fbSoftGlow)"
									className="transition-all duration-700"
								/>
							)}
							<path
								d={curvePath(SLOT_X + 80, slot.y, CCA_X - 28, cy)}
								stroke={color}
								strokeWidth={isDead ? 1.5 : 2}
								fill="none"
								strokeLinecap="round"
								strokeDasharray={isActive ? "8 6" : isDead ? "4 4" : "none"}
								opacity={isDead ? 0.2 : 0.9}
								className={cn(
									"transition-all duration-700",
									isActive && "animate-[dash-flow_0.8s_linear_infinite]",
								)}
							/>
							{isDead && (
								<g className="animate-[fade-in-scale_0.4s_ease-out_both]">
									<circle
										cx={(SLOT_X + 80 + CCA_X - 28) / 2}
										cy={(slot.y + cy) / 2}
										r={9}
										fill="rgba(148,163,184,0.1)"
									/>
									<text
										x={(SLOT_X + 80 + CCA_X - 28) / 2}
										y={(slot.y + cy) / 2 + 1}
										textAnchor="middle"
										dominantBaseline="central"
										fill="#94a3b8"
										fontSize="11"
										fontWeight="bold"
									>
										{"✕"}
									</text>
								</g>
							)}
							{isApproved && (
								<g className="animate-[fade-in-scale_0.4s_ease-out_both]">
									<circle
										cx={(SLOT_X + 80 + CCA_X - 28) / 2}
										cy={(slot.y + cy) / 2}
										r={9}
										fill="rgba(34,197,94,0.1)"
									/>
									<text
										x={(SLOT_X + 80 + CCA_X - 28) / 2}
										y={(slot.y + cy) / 2 + 1}
										textAnchor="middle"
										dominantBaseline="central"
										fill="#22c55e"
										fontSize="11"
										fontWeight="bold"
									>
										{"✓"}
									</text>
								</g>
							)}
						</g>
					);
				})}

				{/* Venue slot nodes */}
				{slots.map((slot) => {
					const borderColor = slotBorderColor(slot.state);
					const isConflict = slot.state === "conflict";
					const isApproved = slot.state === "approved";
					return (
						<g key={slot.id}>
							{isConflict && (
								<rect
									x={SLOT_X - 78}
									y={slot.y - 22}
									width={156}
									height={44}
									rx={10}
									fill="#f87171"
									opacity={0.06}
									className="animate-[node-pulse_1.5s_ease-in-out_infinite]"
								/>
							)}
							{isApproved && (
								<rect
									x={SLOT_X - 78}
									y={slot.y - 22}
									width={156}
									height={44}
									rx={10}
									fill="#22c55e"
									opacity={0.04}
								/>
							)}
							<rect
								x={SLOT_X - 75}
								y={slot.y - 20}
								width={150}
								height={40}
								rx={8}
								fill="rgba(15,23,42,0.95)"
								stroke={borderColor}
								strokeWidth={1.5}
								className="transition-all duration-500"
							/>
							<text
								x={SLOT_X}
								y={slot.y - 5}
								textAnchor="middle"
								dominantBaseline="central"
								fill={isApproved ? "#22c55e" : isConflict ? "#f87171" : "rgba(226,232,240,0.8)"}
								fontSize="11"
								fontWeight="600"
								className="transition-all duration-500"
							>
								{slot.label}
							</text>
							<text
								x={SLOT_X}
								y={slot.y + 10}
								textAnchor="middle"
								dominantBaseline="central"
								fill="rgba(148,163,184,0.5)"
								fontSize="9"
							>
								{slot.day} {slot.time}
							</text>
						</g>
					);
				})}

				{/* Negotiate arrow */}
				{isNegotiating && (
					<g className="animate-[fade-in-scale_0.5s_ease-out_both]">
						<line
							x1={CCA_X}
							y1={CCA_YS[0] + 22}
							x2={CCA_X}
							y2={CCA_YS[1] - 22}
							stroke="#fbbf24"
							strokeWidth={1.5}
							strokeDasharray="4 3"
							className="animate-[dash-flow_1s_linear_infinite]"
						/>
						<text
							x={CCA_X + 16}
							y={(CCA_YS[0] + CCA_YS[1]) / 2}
							textAnchor="start"
							dominantBaseline="central"
							fill="#fbbf24"
							fontSize="9"
							fontWeight="600"
						>
							Negotiate
						</text>
					</g>
				)}

				{/* JCRC node */}
				{showJcrc && (
					<g className="animate-[fade-in-scale_0.5s_ease-out_both]">
						<line
							x1={JCRC_X}
							y1={JCRC_Y - 18}
							x2={SLOT_X}
							y2={SLOT_MON_Y + 20}
							stroke="#a855f7"
							strokeWidth={1.5}
							strokeDasharray="6 4"
							opacity={0.5}
						/>
						<rect
							x={JCRC_X - 32}
							y={JCRC_Y - 14}
							width={64}
							height={28}
							rx={14}
							fill="rgba(15,23,42,0.95)"
							stroke="#a855f7"
							strokeWidth={1.5}
						/>
						<text
							x={JCRC_X}
							y={JCRC_Y}
							textAnchor="middle"
							dominantBaseline="central"
							fill="#a855f7"
							fontSize="11"
							fontWeight="700"
						>
							JCRC
						</text>
					</g>
				)}

				{/* CCA nodes */}
				{CCAS.map((cca, i) => {
					const y = CCA_YS[i];
					const link = links.find((l) => l.ccaId === cca.id);
					const isActive =
						link && link.state !== "none" && link.state !== "yielded" && link.state !== "rejected";
					const isApproved = link?.state === "approved";
					const isDead = link?.state === "yielded" || link?.state === "rejected";
					return (
						<g key={cca.id}>
							{isActive && (
								<circle
									cx={CCA_X}
									cy={y}
									r={28}
									fill={isApproved ? "#22c55e" : cca.color}
									opacity={0.06}
									className="animate-[node-pulse_1.5s_ease-in-out_infinite]"
									style={{ animationDelay: `${i * 0.15}s` }}
								/>
							)}
							<circle
								cx={CCA_X}
								cy={y}
								r={22}
								fill={cca.color}
								opacity={0.08}
								filter="url(#fbSoftGlow)"
								className="transition-all duration-500"
							/>
							<circle
								cx={CCA_X}
								cy={y}
								r={18}
								fill="rgba(15,23,42,0.9)"
								stroke={isApproved ? "#22c55e" : isDead ? "rgba(148,163,184,0.2)" : cca.color}
								strokeWidth={isActive ? 2.5 : 2}
								strokeDasharray={isDead ? "4 3" : "none"}
								opacity={isDead ? 0.5 : 1}
								className="transition-all duration-500"
							/>
							{isApproved ? (
								<text
									x={CCA_X}
									y={y + 1}
									textAnchor="middle"
									dominantBaseline="central"
									fill="#22c55e"
									fontSize="13"
									className="animate-[fade-in-scale_0.4s_ease-out_both]"
								>
									{"✓"}
								</text>
							) : (
								<text
									x={CCA_X}
									y={y + 1}
									textAnchor="middle"
									dominantBaseline="central"
									fill={isDead ? "rgba(148,163,184,0.3)" : cca.color}
									fontSize="13"
									fontWeight="600"
									opacity={isDead ? 0.5 : 0.8}
									className="transition-all duration-500"
								>
									{cca.abbr}
								</text>
							)}
							<text
								x={CCA_X}
								y={y + 34}
								textAnchor="middle"
								fill={isDead ? "rgba(148,163,184,0.3)" : "rgba(226,232,240,0.9)"}
								fontSize="10"
								fontWeight="600"
								className="transition-all duration-500"
							>
								{cca.name}
							</text>
						</g>
					);
				})}
			</svg>

			{/* Result cards */}
			{(current.phase === "yield" || current.phase === "jcrc" || current.phase === "summary") && (
				<div key={`results-${step}`} className="mb-3 animate-[fade-up_0.4s_ease-out_both]">
					<div className="grid grid-cols-3 gap-2">
						{CCAS.map((cca) => {
							const link = links.find((l) => l.ccaId === cca.id);
							const isApproved = link?.state === "approved";
							const slot = isApproved ? slots.find((s) => s.id === link?.slotId) : null;
							return (
								<div
									key={cca.id}
									className={cn(
										"rounded-lg border p-3 text-center",
										isApproved
											? "border-emerald-500/20 bg-emerald-500/5"
											: "border-slate-800/40 bg-slate-900/30",
									)}
								>
									<div className="flex items-center justify-center gap-1.5 mb-1">
										<span className="size-2 rounded-full" style={{ background: cca.color }} />
										<span className="text-xs font-medium text-slate-300">{cca.name}</span>
									</div>
									{isApproved && slot ? (
										<>
											<p className="text-emerald-400 text-sm font-bold">
												{slot.day} {slot.time}
											</p>
											<p className="text-[10px] text-slate-600">{slot.label}</p>
										</>
									) : (
										<>
											<p className="text-slate-500 text-sm font-medium">No booking</p>
											<p className="text-[10px] text-slate-600">Find another slot</p>
										</>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Description */}
			<div className="min-h-[72px] flex items-start justify-center mt-3 px-2">
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
