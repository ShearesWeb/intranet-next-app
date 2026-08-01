"use client";

import { CSSProperties, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

const FONT_SANS = "var(--font-quicksand), system-ui, sans-serif";
const FONT_DISPLAY = "var(--font-fredoka), sans-serif";
const FONT_MONO = "var(--font-space-mono), monospace";

const HEART_D =
	"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

type PosId = "head" | "sous" | "pastry" | "dish";
type RoundNo = 1 | 2;

interface Position {
	id: PosId;
	name: string;
	seats: number;
	ranking: string[];
	warn: boolean;
}

interface Applicant {
	id: string;
	name: string;
	wish: PosId[];
}

interface Holder {
	n: string;
	r: RoundNo;
}

type Board = Record<PosId, Holder[]>;

interface LogLine {
	tag: string;
	text: string;
	color: string;
}

type StepKind =
	| "title"
	| "rulesA"
	| "rulesB"
	| "cast"
	| "roundcard"
	| "event"
	| "compare"
	| "resolve"
	| "terminate"
	| "results"
	| "close1"
	| "close2"
	| "replay";

interface Step {
	kind: StepKind;
	round: number;
	board?: Board;
	grey?: Record<string, PosId[]>;
	tray?: string[];
	active?: { a: string; p: PosId; i: number };
	displaced?: string;
	final?: boolean;
	compare?: { pos: PosId; arriving: string; holders: string[]; verdict: string };
	caption?: string;
	log?: LogLine[];
}

const POSITIONS: Position[] = [
	{ id: "head", name: "Programmes", seats: 1, ranking: ["Raegan", "Danielle"], warn: false },
	{ id: "sous", name: "Marketing", seats: 1, ranking: ["Danielle", "Amir"], warn: false },
	{
		id: "pastry",
		name: "Logistics",
		seats: 2,
		ranking: ["Alexis", "Celeste", "Amir", "Danielle"],
		warn: false,
	},
	{ id: "dish", name: "Publicity", seats: 1, ranking: ["Raegan"], warn: true },
];

const POSNAME: Record<PosId, string> = {
	head: "Programmes",
	sous: "Marketing",
	pastry: "Logistics",
	dish: "Publicity",
};

const APPLICANTS: Applicant[] = [
	{ id: "danielle", name: "Danielle", wish: ["head", "sous"] },
	{ id: "alexis", name: "Alexis", wish: ["pastry"] },
	{ id: "raegan", name: "Raegan", wish: ["head"] },
	{ id: "amir", name: "Amir", wish: ["sous", "pastry"] },
	{ id: "celeste", name: "Celeste", wish: ["pastry"] },
];

const NAME2ID: Record<string, string> = {};
APPLICANTS.forEach((a) => {
	NAME2ID[a.name] = a.id;
});

const C = {
	info: "#9E92BC",
	ask: "#FFA8C4",
	full: "#FFC177",
	swap: "#FF5C93",
	out: "#9E92BC",
	done: "#FFD9E6",
};

const L = (tag: string, text: string, color: string): LogLine => ({ tag, text, color });
const H = (n: string, r: RoundNo): Holder => ({ n, r });
const bd = (head: Holder[] = [], sous: Holder[] = [], pastry: Holder[] = []): Board => ({
	head,
	sous,
	pastry,
	dish: [],
});

const B_EMPTY = bd();
const B1 = bd([H("Danielle", 1)]);
const B2 = bd([H("Danielle", 1)], [], [H("Alexis", 1)]);
const B3 = bd([H("Raegan", 1)], [], [H("Alexis", 1)]);
const B4 = bd([H("Raegan", 1)], [H("Amir", 1)], [H("Alexis", 1)]);
const B5 = bd([H("Raegan", 1)], [H("Amir", 1)], [H("Alexis", 1), H("Celeste", 1)]);
const B6 = bd([H("Raegan", 1)], [H("Danielle", 2)], [H("Alexis", 1), H("Celeste", 1)]);

const G1: Record<string, PosId[]> = { danielle: ["head"] };
const G2: Record<string, PosId[]> = { danielle: ["head"], amir: ["sous"] };
const G3: Record<string, PosId[]> = { danielle: ["head"], amir: ["sous", "pastry"] };

const STEPS: Step[] = [
	{ kind: "title", round: 0 },
	{ kind: "rulesA", round: 0 },
	{ kind: "rulesB", round: 0 },
	{
		kind: "cast",
		round: 0,
		board: B_EMPTY,
		caption: "Everyone has indicated their preferences. It's time to run our matching!",
		log: [L("START", "5 people · 4 positions · 5 spots", C.info)],
	},

	{
		kind: "roundcard",
		round: 1,
		board: B_EMPTY,
		caption: "Round 1: everyone proposes to their first choice.",
		log: [L("ROUND", "Round 1", C.info)],
	},
	{
		kind: "event",
		round: 1,
		board: B1,
		active: { a: "danielle", p: "head", i: 0 },
		caption:
			"Danielle proposes to Programmes. Since a spot is available, she is preallocated a position.",
		log: [L("ASK", "Danielle → allocated Programmes", C.ask)],
	},
	{
		kind: "event",
		round: 1,
		board: B2,
		active: { a: "alexis", p: "pastry", i: 0 },
		caption:
			"Alexis proposes to Logistics. Since a spot is available, she is preallocated a position.",
		log: [L("ASK", "Alexis → allocated Logistics", C.ask)],
	},
	{
		kind: "event",
		round: 1,
		board: B2,
		active: { a: "raegan", p: "head", i: 0 },
		caption: "Raegan proposes to Programmes, but that spot is already taken.",
		log: [L("FULL", "Raegan → Programmes full", C.full)],
	},
	{
		kind: "compare",
		round: 1,
		board: B2,
		active: { a: "raegan", p: "head", i: 0 },
		compare: {
			pos: "head",
			arriving: "Raegan",
			holders: ["Danielle"],
			verdict:
				"Wayne (Chair) ranked Raegan higher than Danielle. Raegan gets the seat. Danielle is displaced.",
		},
		caption:
			"In the case where the position does not contain more available spots, we'll reference chair rankings to make a decision.",
		log: [L("COMPARE", "Raegan vs Danielle", C.swap)],
	},
	{
		kind: "resolve",
		round: 1,
		board: B3,
		grey: G1,
		displaced: "danielle",
		caption: "Raegan is allocated a spot in Programmes.",
		log: [L("DISPLACED", "Raegan #1 > Danielle #2 → Danielle displaced", C.swap)],
	},
	{
		kind: "event",
		round: 1,
		board: B4,
		grey: G1,
		active: { a: "amir", p: "sous", i: 0 },
		caption:
			"Amir proposes to Marketing. Since a spot is available, he is preallocated a position.",
		log: [L("ASK", "Amir → allocated Marketing", C.ask)],
	},
	{
		kind: "event",
		round: 1,
		board: B5,
		grey: G1,
		active: { a: "celeste", p: "pastry", i: 1 },
		caption: "Celeste proposes to Logistics. She takes the last spot, so the position is now full.",
		log: [L("ASK", "Celeste → allocated Logistics · full", C.ask)],
	},

	{
		kind: "roundcard",
		round: 2,
		board: B5,
		grey: G1,
		caption: "Round 2: anyone without a position proposes to their next choice.",
		log: [L("ROUND", "Round 2 · Danielle unallocated", C.info)],
	},
	{
		kind: "event",
		round: 2,
		board: B5,
		grey: G1,
		active: { a: "danielle", p: "sous", i: 0 },
		caption: "Danielle proposes to Marketing, but that spot is already taken.",
		log: [L("FULL", "Danielle → Marketing full", C.full)],
	},
	{
		kind: "compare",
		round: 2,
		board: B5,
		grey: G1,
		active: { a: "danielle", p: "sous", i: 0 },
		compare: {
			pos: "sous",
			arriving: "Danielle",
			holders: ["Amir"],
			verdict:
				"Wayne (Chair) ranked Danielle higher than Amir. Danielle gets the seat. Amir is displaced.",
		},
		caption:
			"Again the position has no available spots, so we reference chair rankings to make a decision.",
		log: [L("COMPARE", "Danielle vs Amir", C.swap)],
	},
	{
		kind: "resolve",
		round: 2,
		board: B6,
		grey: G2,
		displaced: "amir",
		caption: "Danielle was displaced in Round 1. Now she is allocated a spot in Marketing.",
		log: [L("DISPLACED", "Danielle #1 > Amir #2 → Amir displaced", C.swap)],
	},
	{
		kind: "event",
		round: 2,
		board: B6,
		grey: G2,
		active: { a: "amir", p: "pastry", i: 1 },
		caption: "Amir proposes to Logistics, but both spots are already taken.",
		log: [L("FULL", "Amir → Logistics full", C.full)],
	},
	{
		kind: "compare",
		round: 2,
		board: B6,
		grey: G2,
		active: { a: "amir", p: "pastry", i: 1 },
		compare: {
			pos: "pastry",
			arriving: "Amir",
			holders: ["Alexis", "Celeste"],
			verdict:
				"Wayne (Chair) ranked both Alexis and Celeste higher than Amir. Nobody is displaced.",
		},
		caption: "Compare the proposer against its lowest ranked holder.",
		log: [L("COMPARE", "Amir vs Alexis + Celeste", C.swap)],
	},
	{
		kind: "resolve",
		round: 2,
		board: B6,
		grey: G3,
		tray: ["amir"],
		caption:
			"When the proposer ranks below every holder, no spot is allocated and they move on to their next choice.",
		log: [L("OUT", "Amir #3 below both → no choices left", C.out)],
	},

	{
		kind: "terminate",
		round: 3,
		board: B6,
		grey: G3,
		tray: ["amir"],
		final: true,
		caption: "Now, and only now, are these allocations final.",
		log: [
			L("DONE", "No proposals left · run stops", C.done),
			L("DONE", "Allocations final", C.done),
		],
	},
	{
		kind: "results",
		round: 3,
		board: B6,
		grey: G3,
		tray: ["amir"],
		final: true,
		caption: "These are the final matches of the whole run.",
		log: [
			L(
				"DONE",
				"Programmes Raegan · Marketing Danielle · Logistics Alexis + Celeste · Publicity empty · Amir unallocated",
				C.done,
			),
		],
	},
	{
		kind: "close1",
		round: 3,
		board: B6,
		grey: G3,
		tray: ["amir"],
		final: true,
		log: [L("OUT", "Publicity ranking: 1 name, 1 spot", C.out)],
	},
	{
		kind: "close2",
		round: 3,
		board: B6,
		grey: G3,
		tray: ["amir"],
		final: true,
		caption: "Rank at least 200% of your empty seats.",
		log: [L("OUT", "Raegan → Programmes · no backup → spot empty", C.out)],
	},
	{
		kind: "replay",
		round: 3,
		board: B6,
		grey: G3,
		tray: ["amir"],
		final: true,
		log: [L("START", "Replay: Publicity, 2 names", C.info)],
	},
];

interface ConnectorLine {
	key: string;
	aid: string;
	pos: PosId;
	idx: number;
	r: number;
	ask?: boolean;
}

interface GeomLine {
	key: string;
	d: string;
}

function Heart({
	size,
	fill,
	stroke,
	style,
}: {
	size: number;
	fill?: string;
	stroke?: string;
	style?: CSSProperties;
}) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" style={style}>
			<path
				d={HEART_D}
				style={{ fill: fill ?? "none", stroke, strokeWidth: stroke ? 2 : undefined }}
			/>
		</svg>
	);
}

const OVERLAY_BASE: CSSProperties = {
	position: "absolute",
	inset: 0,
	zIndex: 20,
	backdropFilter: "blur(7px)",
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "center",
	padding: "20px 24px",
	overflowY: "auto",
	animation: "cupid-fade-in .35s ease-out both",
};

const SLIDE_LABEL: CSSProperties = {
	fontFamily: FONT_MONO,
	fontSize: 9.5,
	letterSpacing: ".2em",
};

export function CupidAnimation() {
	const [stepIndex, setStepIndex] = useState(0);
	const [geom, setGeom] = useState<GeomLine[]>([]);

	const els = useRef<Record<string, HTMLElement>>({});
	const refCache = useRef<Record<string, (el: HTMLElement | null) => void>>({});
	const linesRef = useRef<ConnectorLine[]>([]);
	const geomSig = useRef("");
	const stageRef = useRef<HTMLDivElement | null>(null);
	const logRef = useRef<HTMLDivElement | null>(null);

	const getRef = useCallback((key: string) => {
		if (!refCache.current[key]) {
			refCache.current[key] = (el: HTMLElement | null) => {
				if (el) els.current[key] = el;
				else delete els.current[key];
			};
		}
		return refCache.current[key];
	}, []);

	const go = useCallback((delta: number) => {
		setStepIndex((prev) => {
			if (delta > 0 && prev === STEPS.length - 1) return 0;
			const next = prev + delta;
			if (next < 0 || next > STEPS.length - 1) return prev;
			return next;
		});
	}, []);

	// Arrow keys drive the deck, but never steal typing from a form control.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
			if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
				e.preventDefault();
				go(1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				go(-1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [go]);

	// Connectors are measured from live DOM boxes, so they survive any reflow.
	useEffect(() => {
		let alive = true;
		let raf = 0;
		const measure = () => {
			const stage = stageRef.current;
			if (stage) {
				const sr = stage.getBoundingClientRect();
				const out: GeomLine[] = [];
				for (const line of linesRef.current) {
					const a = els.current["app:" + line.aid];
					const s = els.current[`seat:${line.pos}:${line.idx}`];
					if (!a || !s) continue;
					const ar = a.getBoundingClientRect();
					const br = s.getBoundingClientRect();
					const x1 = ar.right - sr.left - 4;
					const y1 = ar.top + ar.height / 2 - sr.top;
					const x2 = br.left - sr.left - 3;
					const y2 = br.top + br.height / 2 - sr.top;
					const dx = Math.max(54, (x2 - x1) * 0.45);
					out.push({
						key: line.key,
						d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
					});
				}
				const sig = JSON.stringify(out);
				if (sig !== geomSig.current) {
					geomSig.current = sig;
					setGeom(out);
				}
			}
			if (alive) raf = requestAnimationFrame(measure);
		};
		raf = requestAnimationFrame(measure);
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
		};
	}, []);

	useEffect(() => {
		if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
	}, [stepIndex]);

	const vm = useMemo(() => {
		const st = STEPS[stepIndex];
		const board = st.board || B_EMPTY;
		const grey = st.grey || {};
		const tray = st.tray || [];
		const isFinal = !!st.final;
		const rnd = st.round;

		const holderPos: Record<string, PosId> = {};
		const holderRound: Record<string, RoundNo> = {};
		POSITIONS.forEach((p) =>
			(board[p.id] || []).forEach((h) => {
				holderPos[NAME2ID[h.n]] = p.id;
				holderRound[NAME2ID[h.n]] = h.r;
			}),
		);

		const applicants = APPLICANTS.filter((a) => tray.indexOf(a.id) === -1).map((a) => {
			const hp = holderPos[a.id] || null;
			const hr = holderRound[a.id];
			const active = !!(st.active && st.active.a === a.id);
			return {
				id: a.id,
				name: a.name,
				hold1: !!hp && hr === 1 && !active,
				hold2: !!hp && hr === 2 && !active,
				act1: active && rnd === 1,
				act2: active && rnd === 2,
				isDisplaced: st.displaced === a.id,
				statusText: hp
					? "in " + POSNAME[hp]
					: active
						? "asking"
						: st.displaced === a.id
							? ""
							: "no seat",
				wish: a.wish.map((p, ix) => {
					const greyed = (grey[a.id] || []).indexOf(p) !== -1;
					const held = !greyed && hp === p;
					return { n: ix + 1, label: POSNAME[p], greyed, held, live: !greyed && !held };
				}),
			};
		});

		const trayCards = tray.map((id) => {
			const a = APPLICANTS.find((x) => x.id === id)!;
			return { id, name: a.name, wishText: a.wish.map((p) => POSNAME[p]).join(" · ") };
		});

		const lines: ConnectorLine[] = [];
		const positions = POSITIONS.map((p) => {
			const holders = board[p.id] || [];
			const seats = [];
			for (let k = 0; k < p.seats; k++) {
				const h = holders[k] || null;
				seats.push({
					key: p.id + k,
					pos: p.id,
					idx: k,
					holder: h ? h.n : null,
					empty: !h,
					f1: !!h && h.r === 1,
					f2: !!h && h.r === 2,
				});
				if (h) lines.push({ key: p.id + k, aid: NAME2ID[h.n], pos: p.id, idx: k, r: h.r });
			}
			return {
				id: p.id,
				name: p.name,
				seatsLabel: p.seats + (p.seats > 1 ? " seats" : " seat"),
				rankingText: p.ranking.map((n, ix) => `${ix + 1}. ${n}`).join("   ·   "),
				warn: p.warn,
				ok: !p.warn,
				full: holders.length >= p.seats,
				seats,
			};
		});
		if (st.active && st.active.p) {
			lines.push({
				key: "__ask",
				aid: st.active.a,
				pos: st.active.p,
				idx: st.active.i,
				r: rnd,
				ask: true,
			});
		}

		const geomByKey: Record<string, GeomLine> = {};
		geom.forEach((g) => {
			geomByKey[g.key] = g;
		});
		const held = lines.filter((l) => !l.ask);
		const pick = (rr: number) =>
			held
				.filter((l) => l.r === rr)
				.map((l) => geomByKey[l.key])
				.filter(Boolean);
		const askGeom = geomByKey["__ask"] ? [geomByKey["__ask"]] : [];

		let compareRows: {
			n: number;
			name: string;
			arriving: boolean;
			holding: boolean;
			other: boolean;
			cut: boolean;
		}[] = [];
		let compareTitle = "";
		let compareseats = "";
		let compareVerdict = "";
		if (st.compare) {
			const p = POSITIONS.find((x) => x.id === st.compare!.pos)!;
			compareTitle = p.name;
			compareseats = p.seats + (p.seats > 1 ? " seats" : " seat");
			compareVerdict = st.compare.verdict;
			compareRows = p.ranking.map((n, ix) => {
				const arriving = n === st.compare!.arriving;
				const holding = st.compare!.holders.indexOf(n) !== -1;
				return {
					n: ix + 1,
					name: n,
					arriving,
					holding,
					other: !arriving && !holding,
					cut: ix + 1 === p.seats,
				};
			});
		}

		let logLines: LogLine[] = [];
		for (let k = 0; k <= stepIndex; k++) {
			if (STEPS[k].log) logLines = logLines.concat(STEPS[k].log!);
		}

		const seated = POSITIONS.reduce((s, p) => s + (board[p.id] || []).length, 0);
		const showBoard = ["title", "rulesA", "rulesB"].indexOf(st.kind) === -1;

		return {
			lines,
			applicants,
			positions,
			tray: trayCards,
			hasTray: trayCards.length > 0,
			dash1: isFinal ? [] : pick(1),
			dash2: isFinal ? [] : pick(2),
			solid1: isFinal ? pick(1) : [],
			solid2: isFinal ? pick(2) : [],
			arrow1: rnd === 1 ? askGeom : [],
			arrow2: rnd === 2 ? askGeom : [],
			logLines,
			showRule: !!st.caption,
			caption: st.caption || "",
			roundLabel: rnd === 3 ? "done" : "—",
			isR1: rnd === 1,
			isR2: rnd === 2,
			isR0: rnd !== 1 && rnd !== 2,
			unmatchedLabel: showBoard ? String(APPLICANTS.length - seated) : "—",
			showBoard,
			isTitle: st.kind === "title",
			isRulesA: st.kind === "rulesA",
			isRulesB: st.kind === "rulesB",
			isCompare: st.kind === "compare",
			isResults: st.kind === "results",
			isRC1: st.kind === "roundcard" && rnd === 1,
			isRC2: st.kind === "roundcard" && rnd === 2,
			isClose1: st.kind === "close1",
			isClose2: st.kind === "close2",
			isReplay: st.kind === "replay",
			compareRows,
			compareTitle,
			compareseats,
			compareVerdict,
			ticks: STEPS.map((s, ix) => ({
				d1: ix <= stepIndex && s.round !== 2,
				d2: ix <= stepIndex && s.round === 2,
				todo: ix > stepIndex,
			})),
			nextLabel: stepIndex === 0 ? "Start" : stepIndex === STEPS.length - 1 ? "Play again" : "Next",
		};
	}, [stepIndex, geom]);

	useEffect(() => {
		linesRef.current = vm.lines;
	}, [vm.lines]);

	return (
		<div
			style={{
				position: "relative",
				isolation: "isolate",
				height: "calc(100vh - 5.5rem)",
				minHeight: 600,
				display: "flex",
				flexDirection: "column",
				borderRadius: 20,
				background:
					"radial-gradient(1200px 680px at 50% -14%, #3A1550 0%, #180B34 40%, #0A0718 78%)",
				color: "#EFEAF6",
				fontFamily: FONT_SANS,
				overflow: "hidden",
			}}
		>
			{/* Drifting hearts, purely ambient. */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					pointerEvents: "none",
					overflow: "hidden",
				}}
			>
				{[
					{ size: 34, left: "7%", top: "78%", dur: "21s", delay: "0s", fill: "#FF3D82" },
					{ size: 20, left: "23%", top: "88%", dur: "26s", delay: "3s", fill: "#A97BFF" },
					{ size: 26, left: "46%", top: "82%", dur: "24s", delay: "8s", fill: "#FF3D82" },
					{ size: 16, left: "67%", top: "92%", dur: "29s", delay: "5s", fill: "#A97BFF" },
					{ size: 30, left: "87%", top: "80%", dur: "23s", delay: "12s", fill: "#FF3D82" },
				].map((h) => (
					<Heart
						key={h.left}
						size={h.size}
						fill={h.fill}
						style={{
							position: "absolute",
							left: h.left,
							top: h.top,
							animation: `cupid-float-up ${h.dur} ease-in-out ${h.delay} infinite both`,
						}}
					/>
				))}
			</div>

			<header
				style={{
					position: "relative",
					zIndex: 1,
					display: "flex",
					alignItems: "center",
					gap: 11,
					padding: "11px 20px 9px",
					borderBottom: "1px solid rgba(255,255,255,.07)",
					flex: "none",
					flexWrap: "wrap",
				}}
			>
				<Heart
					size={20}
					fill="#FF3D82"
					style={{
						flex: "none",
						filter: "drop-shadow(0 0 7px rgba(255,61,130,.7))",
						animation: "cupid-heartbeat 3.4s ease-in-out infinite both",
					}}
				/>
				<div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500 }}>
					Sheares <span style={{ color: "#FF5C93", fontWeight: 600 }}>CUPID</span>
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
					{vm.isR1 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
								border: "1px solid rgba(255,92,147,.5)",
								borderRadius: 999,
								padding: "5px 14px",
								background: "rgba(255,61,130,.14)",
							}}
						>
							<span
								style={{
									fontFamily: FONT_MONO,
									fontSize: 9,
									letterSpacing: ".13em",
									color: "#FF8FB1",
								}}
							>
								ROUND
							</span>
							<span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#FFD9E6" }}>1</span>
						</div>
					)}
					{vm.isR2 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
								border: "1px solid rgba(169,123,255,.55)",
								borderRadius: 999,
								padding: "5px 14px",
								background: "rgba(169,123,255,.15)",
							}}
						>
							<span
								style={{
									fontFamily: FONT_MONO,
									fontSize: 9,
									letterSpacing: ".13em",
									color: "#C7ADFF",
								}}
							>
								ROUND
							</span>
							<span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#E6DAFF" }}>2</span>
						</div>
					)}
					{vm.isR0 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
								border: "1px solid rgba(255,255,255,.11)",
								borderRadius: 999,
								padding: "5px 14px",
								background: "rgba(255,255,255,.03)",
							}}
						>
							<span
								style={{
									fontFamily: FONT_MONO,
									fontSize: 9,
									letterSpacing: ".13em",
									color: "#7A6E96",
								}}
							>
								ROUND
							</span>
							<span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#9E92BC" }}>
								{vm.roundLabel}
							</span>
						</div>
					)}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 7,
							border: "1px solid rgba(255,255,255,.11)",
							borderRadius: 999,
							padding: "5px 14px",
							background: "rgba(255,255,255,.03)",
						}}
					>
						<span
							style={{
								fontFamily: FONT_MONO,
								fontSize: 9,
								letterSpacing: ".13em",
								color: "#9E92BC",
							}}
						>
							NO SPOT YET
						</span>
						<span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#EFEAF6" }}>
							{vm.unmatchedLabel}
						</span>
					</div>
				</div>
			</header>

			<div
				style={{
					position: "relative",
					zIndex: 1,
					flex: 1,
					display: "flex",
					minHeight: 0,
					minWidth: 0,
				}}
			>
				{vm.showBoard && (
					<div
						ref={stageRef}
						style={{
							position: "relative",
							flex: 1,
							display: "flex",
							gap: 14,
							padding: "11px 18px 6px",
							minHeight: 0,
							minWidth: 0,
						}}
					>
						<svg
							style={{
								position: "absolute",
								inset: 0,
								width: "100%",
								height: "100%",
								pointerEvents: "none",
								zIndex: 2,
								overflow: "visible",
							}}
						>
							<defs>
								<marker
									id="cupidTipR1"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="5.5"
									markerHeight="5.5"
									orient="auto"
								>
									<path d="M0 0 L10 5 L0 10 L2.8 5 Z" style={{ fill: "#FF5C93" }} />
								</marker>
								<marker
									id="cupidTipR2"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="5.5"
									markerHeight="5.5"
									orient="auto"
								>
									<path d="M0 0 L10 5 L0 10 L2.8 5 Z" style={{ fill: "#A97BFF" }} />
								</marker>
								<marker
									id="cupidTipS1"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="5"
									markerHeight="5"
									orient="auto"
								>
									<path d="M0 0 L10 5 L0 10 L2.8 5 Z" style={{ fill: "#FF7FA8" }} />
								</marker>
								<marker
									id="cupidTipS2"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="5"
									markerHeight="5"
									orient="auto"
								>
									<path d="M0 0 L10 5 L0 10 L2.8 5 Z" style={{ fill: "#BFA0FF" }} />
								</marker>
							</defs>
							{vm.dash1.map((line) => (
								<path
									key={line.key}
									d={line.d}
									style={{
										fill: "none",
										stroke: "#FF5C93",
										strokeWidth: 2.1,
										strokeDasharray: "9 8",
										strokeLinecap: "round",
										markerEnd: "url(#cupidTipR1)",
										animation:
											"cupid-dashflow 1.4s linear infinite, cupid-line-pulse 2.4s ease-in-out infinite",
										filter: "drop-shadow(0 0 6px rgba(255,92,147,.55))",
									}}
								/>
							))}
							{vm.dash2.map((line) => (
								<path
									key={line.key}
									d={line.d}
									style={{
										fill: "none",
										stroke: "#A97BFF",
										strokeWidth: 2.1,
										strokeDasharray: "9 8",
										strokeLinecap: "round",
										markerEnd: "url(#cupidTipR2)",
										animation:
											"cupid-dashflow 1.4s linear infinite, cupid-line-pulse 2.4s ease-in-out infinite",
										filter: "drop-shadow(0 0 6px rgba(169,123,255,.55))",
									}}
								/>
							))}
							{vm.solid1.map((line) => (
								<path
									key={line.key}
									d={line.d}
									style={{
										fill: "none",
										stroke: "#FF7FA8",
										strokeWidth: 2.6,
										strokeLinecap: "round",
										markerEnd: "url(#cupidTipS1)",
										animation: "cupid-snap-in .55s cubic-bezier(.2,.9,.2,1) both",
										filter: "drop-shadow(0 0 10px rgba(255,92,147,.7))",
									}}
								/>
							))}
							{vm.solid2.map((line) => (
								<path
									key={line.key}
									d={line.d}
									style={{
										fill: "none",
										stroke: "#BFA0FF",
										strokeWidth: 2.6,
										strokeLinecap: "round",
										markerEnd: "url(#cupidTipS2)",
										animation: "cupid-snap-in .55s cubic-bezier(.2,.9,.2,1) both",
										filter: "drop-shadow(0 0 10px rgba(169,123,255,.7))",
									}}
								/>
							))}
							{vm.arrow1.map((line) => (
								<path
									key={line.key}
									d={line.d}
									pathLength={1}
									style={{
										fill: "none",
										stroke: "#FFD9E6",
										strokeWidth: 3,
										strokeLinecap: "round",
										strokeDasharray: 1,
										markerEnd: "url(#cupidTipR1)",
										animation: "cupid-fly-arrow 1.9s cubic-bezier(.3,.75,.3,1) infinite",
										filter: "drop-shadow(0 0 9px rgba(255,92,147,.9))",
									}}
								/>
							))}
							{vm.arrow2.map((line) => (
								<path
									key={line.key}
									d={line.d}
									pathLength={1}
									style={{
										fill: "none",
										stroke: "#E6DAFF",
										strokeWidth: 3,
										strokeLinecap: "round",
										strokeDasharray: 1,
										markerEnd: "url(#cupidTipR2)",
										animation: "cupid-fly-arrow 1.9s cubic-bezier(.3,.75,.3,1) infinite",
										filter: "drop-shadow(0 0 9px rgba(169,123,255,.9))",
									}}
								/>
							))}
						</svg>

						<div
							className="cupid-scroll w-[178px] md:w-[222px]"
							style={{
								position: "relative",
								zIndex: 1,
								flex: "none",
								display: "flex",
								flexDirection: "column",
								gap: 5,
								overflowY: "auto",
								padding: "2px 4px 2px 2px",
							}}
						>
							{vm.applicants.map((app) => (
								<div
									key={app.id}
									ref={getRef("app:" + app.id)}
									style={{
										position: "relative",
										background: "rgba(255,255,255,.05)",
										border: "1px solid rgba(255,255,255,.09)",
										borderRadius: 14,
										padding: "6px 10px",
										flex: "none",
									}}
								>
									{app.hold1 && (
										<div
											style={{
												position: "absolute",
												inset: -1,
												borderRadius: 14,
												border: "1px solid rgba(255,92,147,.5)",
												boxShadow: "0 0 16px rgba(255,61,130,.16)",
												pointerEvents: "none",
											}}
										/>
									)}
									{app.hold2 && (
										<div
											style={{
												position: "absolute",
												inset: -1,
												borderRadius: 14,
												border: "1px solid rgba(169,123,255,.55)",
												boxShadow: "0 0 16px rgba(169,123,255,.18)",
												pointerEvents: "none",
											}}
										/>
									)}
									{app.act1 && (
										<div
											style={{
												position: "absolute",
												inset: -1,
												borderRadius: 14,
												border: "1.5px solid #FF3D82",
												pointerEvents: "none",
												animation: "cupid-soft-pulse 1.9s ease-out infinite",
											}}
										/>
									)}
									{app.act2 && (
										<div
											style={{
												position: "absolute",
												inset: -1,
												borderRadius: 14,
												border: "1.5px solid #A97BFF",
												pointerEvents: "none",
												animation: "cupid-soft-pulse-v 1.9s ease-out infinite",
											}}
										/>
									)}
									{app.isDisplaced && (
										<div
											style={{
												position: "absolute",
												inset: -1,
												borderRadius: 14,
												background: "rgba(255,61,130,.30)",
												pointerEvents: "none",
												animation: "cupid-flash-out 1.2s ease-out forwards",
											}}
										/>
									)}
									<div
										style={{
											position: "relative",
											display: "flex",
											alignItems: "baseline",
											justifyContent: "space-between",
											gap: 6,
										}}
									>
										<div
											style={{
												fontFamily: FONT_DISPLAY,
												fontSize: 16,
												fontWeight: 500,
												color: "#F6F2FC",
											}}
										>
											{app.name}
										</div>
										<div
											style={{
												fontFamily: FONT_MONO,
												fontSize: 8.5,
												letterSpacing: ".05em",
												textTransform: "uppercase",
												color: "#9E92BC",
												textAlign: "right",
											}}
										>
											{app.statusText}
										</div>
										{app.isDisplaced && (
											<div
												style={{
													fontFamily: FONT_MONO,
													fontSize: 8.5,
													letterSpacing: ".08em",
													color: "#FFC2D6",
													background: "rgba(255,61,130,.18)",
													border: "1px solid rgba(255,92,147,.5)",
													borderRadius: 999,
													padding: "2px 7px",
													whiteSpace: "nowrap",
													animation: "cupid-snap-back .75s cubic-bezier(.2,.85,.2,1) both",
												}}
											>
												LOST THE SPOT
											</div>
										)}
									</div>
									<div
										style={{
											position: "relative",
											display: "flex",
											flexDirection: "column",
											gap: 2,
											marginTop: 5,
										}}
									>
										{app.wish.map((w) => (
											<Fragment key={w.n}>
												{w.held && (
													<div
														style={{
															display: "flex",
															gap: 6,
															alignItems: "center",
															fontSize: 12.5,
															color: "#FFD9E6",
														}}
													>
														<span
															style={{
																fontFamily: FONT_MONO,
																fontSize: 10.5,
																color: "#FF5C93",
																width: 12,
																flex: "none",
															}}
														>
															{w.n}
														</span>
														<span>{w.label}</span>
														<Heart
															size={11}
															fill="#FF5C93"
															style={{ marginLeft: "auto", flex: "none" }}
														/>
													</div>
												)}
												{w.live && (
													<div
														style={{
															display: "flex",
															gap: 6,
															alignItems: "center",
															fontSize: 12.5,
															color: "#CFC6E4",
														}}
													>
														<span
															style={{
																fontFamily: FONT_MONO,
																fontSize: 10.5,
																color: "#FF8FB1",
																width: 12,
																flex: "none",
															}}
														>
															{w.n}
														</span>
														<span>{w.label}</span>
													</div>
												)}
												{w.greyed && (
													<div
														style={{
															display: "flex",
															gap: 6,
															alignItems: "center",
															fontSize: 12.5,
															color: "#544B70",
															textDecoration: "line-through",
														}}
													>
														<span
															style={{
																fontFamily: FONT_MONO,
																fontSize: 10.5,
																color: "#453C60",
																width: 12,
																flex: "none",
															}}
														>
															{w.n}
														</span>
														<span>{w.label}</span>
													</div>
												)}
											</Fragment>
										))}
									</div>
								</div>
							))}

							{vm.hasTray && (
								<div
									style={{
										marginTop: 4,
										paddingTop: 9,
										borderTop: "1px dashed rgba(255,255,255,.13)",
										display: "flex",
										flexDirection: "column",
										gap: 6,
										animation: "cupid-fade-up .5s ease-out both",
									}}
								>
									<div
										style={{
											fontFamily: FONT_MONO,
											fontSize: 9,
											letterSpacing: ".16em",
											color: "#7A6E96",
										}}
									>
										NO SPOT
									</div>
									{vm.tray.map((t) => (
										<div
											key={t.id}
											style={{
												border: "1px dashed rgba(255,255,255,.16)",
												borderRadius: 13,
												padding: "7px 11px",
												background: "rgba(255,255,255,.02)",
												animation: "cupid-snap-back .7s cubic-bezier(.2,.85,.2,1) both",
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "baseline",
													justifyContent: "space-between",
													gap: 8,
												}}
											>
												<div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: "#9E92BC" }}>
													{t.name}
												</div>
												<div
													style={{
														fontFamily: FONT_MONO,
														fontSize: 8.5,
														letterSpacing: ".05em",
														color: "#6C6190",
													}}
												>
													ASKED EVERYONE
												</div>
											</div>
											<div
												style={{
													fontSize: 11.5,
													color: "#544B70",
													textDecoration: "line-through",
													marginTop: 3,
												}}
											>
												{t.wishText}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div
							className="cupid-scroll"
							style={{
								position: "relative",
								zIndex: 1,
								flex: 1,
								display: "flex",
								flexDirection: "column",
								gap: 8,
								justifyContent: "flex-start",
								minWidth: 0,
								minHeight: 0,
								overflowY: "auto",
								padding: "1px 2px 2px 1px",
							}}
						>
							{vm.positions.map((pos) => (
								<div
									key={pos.id}
									style={{
										position: "relative",
										background: "rgba(23,13,44,.93)",
										border: "1px solid rgba(255,255,255,.10)",
										borderRadius: 16,
										padding: "7px 13px 8px",
										display: "flex",
										flexDirection: "column",
										gap: 3,
										flex: "none",
									}}
								>
									<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 7,
												flexWrap: "wrap",
												flex: 1,
												minWidth: 0,
											}}
										>
											<div
												style={{
													fontFamily: FONT_DISPLAY,
													fontSize: 17,
													fontWeight: 500,
													color: "#F6F2FC",
												}}
											>
												{pos.name}
											</div>
											<div
												style={{
													fontFamily: FONT_MONO,
													fontSize: 9.5,
													color: "#9E92BC",
													border: "1px solid rgba(255,255,255,.12)",
													borderRadius: 999,
													padding: "1px 8px",
												}}
											>
												{pos.seatsLabel}
											</div>
											{pos.warn && (
												<div
													style={{
														fontFamily: FONT_MONO,
														fontSize: 9,
														color: "#FFC177",
														border: "1px solid rgba(255,179,92,.42)",
														background: "rgba(255,179,92,.11)",
														borderRadius: 999,
														padding: "1px 8px",
														whiteSpace: "nowrap",
													}}
												>
													only 100%
												</div>
											)}
											{pos.ok && (
												<div
													style={{
														fontFamily: FONT_MONO,
														fontSize: 9,
														color: "#6C6190",
														border: "1px solid rgba(255,255,255,.09)",
														borderRadius: 999,
														padding: "1px 8px",
													}}
												>
													200%
												</div>
											)}
										</div>
										{pos.full && (
											<div
												style={{
													flex: "none",
													fontFamily: FONT_MONO,
													fontSize: 9,
													fontWeight: 700,
													letterSpacing: ".16em",
													color: "#160A22",
													background: "linear-gradient(90deg,#FF8FB1,#FF3D82)",
													borderRadius: 5,
													padding: "2px 10px",
													boxShadow: "0 2px 12px rgba(255,61,130,.42)",
													animation: "cupid-ribbon-drop .55s cubic-bezier(.2,.85,.2,1) both",
												}}
											>
												FULL
											</div>
										)}
										<div style={{ display: "flex", gap: 8, flex: "none" }}>
											{pos.seats.map((seat) => (
												<div
													key={seat.key}
													ref={getRef(`seat:${seat.pos}:${seat.idx}`)}
													style={{ width: 100, height: 42, position: "relative", flex: "none" }}
												>
													{seat.empty && (
														<div
															style={{
																position: "absolute",
																inset: 0,
																border: "1.5px dashed rgba(255,255,255,.17)",
																borderRadius: 12,
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																gap: 5,
															}}
														>
															<Heart size={13} stroke="#544B70" />
															<span
																style={{
																	fontFamily: FONT_MONO,
																	fontSize: 9,
																	letterSpacing: ".09em",
																	color: "#544B70",
																}}
															>
																FREE
															</span>
														</div>
													)}
													{seat.f1 && (
														<div
															style={{
																position: "absolute",
																inset: 0,
																borderRadius: 12,
																background:
																	"linear-gradient(180deg,rgba(255,92,147,.26),rgba(255,61,130,.08))",
																border: "1px solid rgba(255,92,147,.55)",
																boxShadow: "0 0 20px rgba(255,61,130,.22)",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																gap: 5,
																animation: "cupid-drop-in .5s cubic-bezier(.2,.85,.2,1) both",
															}}
														>
															<Heart size={12} fill="#FF8FB1" style={{ flex: "none" }} />
															<span
																style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#FFE7EF" }}
															>
																{seat.holder}
															</span>
														</div>
													)}
													{seat.f2 && (
														<div
															style={{
																position: "absolute",
																inset: 0,
																borderRadius: 12,
																background:
																	"linear-gradient(180deg,rgba(169,123,255,.28),rgba(139,92,246,.08))",
																border: "1px solid rgba(169,123,255,.6)",
																boxShadow: "0 0 20px rgba(169,123,255,.24)",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																gap: 5,
																animation: "cupid-drop-in .5s cubic-bezier(.2,.85,.2,1) both",
															}}
														>
															<Heart size={12} fill="#C7ADFF" style={{ flex: "none" }} />
															<span
																style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#EFE6FF" }}
															>
																{seat.holder}
															</span>
														</div>
													)}
												</div>
											))}
										</div>
									</div>
									<div
										style={{
											fontFamily: FONT_MONO,
											fontSize: 10.5,
											color: "#7A6E96",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{pos.rankingText}
									</div>
								</div>
							))}
						</div>

						<div
							className="hidden lg:flex"
							style={{
								position: "relative",
								zIndex: 1,
								flex: "1 1 210px",
								maxWidth: 246,
								minWidth: 0,
								flexDirection: "column",
								background: "rgba(10,6,26,.72)",
								border: "1px solid rgba(255,255,255,.08)",
								borderRadius: 16,
								overflow: "hidden",
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									padding: "9px 12px",
									borderBottom: "1px solid rgba(255,255,255,.07)",
									background: "rgba(255,255,255,.02)",
									flex: "none",
								}}
							>
								<span
									style={{
										width: 7,
										height: 7,
										borderRadius: 99,
										background: "#FF5C93",
										boxShadow: "0 0 8px #FF5C93",
										animation: "cupid-breathe 2.4s ease-in-out infinite",
									}}
								/>
								<span
									style={{
										fontFamily: FONT_MONO,
										fontSize: 9.5,
										letterSpacing: ".16em",
										color: "#C6BCDE",
									}}
								>
									{"CUPID'S NOTES"}
								</span>
							</div>
							<div
								ref={logRef}
								className="cupid-scroll"
								style={{
									flex: 1,
									overflowY: "auto",
									padding: "10px 12px",
									display: "flex",
									flexDirection: "column",
									gap: 8,
								}}
							>
								{vm.logLines.map((l, ix) => (
									<div
										key={`${ix}-${l.text}`}
										style={{
											display: "flex",
											gap: 7,
											alignItems: "flex-start",
											animation: "cupid-fade-up .35s ease-out both",
										}}
									>
										<span
											style={{
												fontFamily: FONT_MONO,
												fontSize: 8.5,
												fontWeight: 700,
												letterSpacing: ".07em",
												padding: "2px 5px",
												borderRadius: 4,
												background: "rgba(255,255,255,.055)",
												flex: "none",
												color: l.color,
											}}
										>
											{l.tag}
										</span>
										<span
											style={{
												fontFamily: FONT_MONO,
												fontSize: 10.5,
												lineHeight: 1.6,
												color: "#B3A9CC",
											}}
										>
											{l.text}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{vm.isTitle && (
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 14,
							padding: "0 20px",
							animation: "cupid-fade-in .6s ease-out both",
						}}
					>
						<svg width="150" height="34" viewBox="0 0 150 34" style={{ overflow: "visible" }}>
							<path
								d="M8 17 H130"
								style={{
									stroke: "#FF5C93",
									strokeWidth: 1.6,
									strokeLinecap: "round",
									opacity: 0.28,
								}}
							/>
							<g style={{ animation: "cupid-arrow-glide 3.4s ease-in-out infinite both" }}>
								<path
									d="M8 17 H126"
									style={{ stroke: "#FF5C93", strokeWidth: 2, strokeLinecap: "round" }}
								/>
								<path d="M126 12 L136 17 L126 22 Z" style={{ fill: "#FF5C93" }} />
								<path
									d="M4 12 L10 17 L4 22"
									style={{
										fill: "none",
										stroke: "#FF5C93",
										strokeWidth: 2,
										strokeLinecap: "round",
										strokeLinejoin: "round",
									}}
								/>
							</g>
						</svg>
						<div
							className="text-[44px] md:text-[70px]"
							style={{
								fontFamily: FONT_DISPLAY,
								fontWeight: 600,
								letterSpacing: "-.02em",
								lineHeight: 1,
								background: "linear-gradient(96deg,#FFE3EC,#FF3D82 48%,#A97BFF)",
								WebkitBackgroundClip: "text",
								backgroundClip: "text",
								color: "transparent",
								animation: "cupid-fade-up .7s ease-out both",
							}}
						>
							Sheares CUPID
						</div>
						<div
							style={{
								fontFamily: FONT_MONO,
								fontSize: 12.5,
								letterSpacing: ".13em",
								color: "#9E92BC",
								textAlign: "center",
								animation: "cupid-fade-up .7s ease-out .18s both",
							}}
						>
							COCURRICULAR UNIFIED PREFERENCE &amp; IMPARTIAL DISTRIBUTION
						</div>
					</div>
				)}

				{vm.isRulesA && (
					<div
						className="cupid-scroll"
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "20px 36px",
							overflowY: "auto",
							animation: "cupid-fade-in .4s ease-out both",
						}}
					>
						<div
							className="flex-col md:flex-row"
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 860,
								background: "rgba(255,255,255,.05)",
								border: "1px solid rgba(255,255,255,.10)",
								borderRadius: 22,
								padding: "32px 38px",
								display: "flex",
								gap: 40,
								alignItems: "center",
								boxShadow: "0 24px 70px rgba(0,0,0,.45)",
							}}
						>
							<div style={{ flex: 1, animation: "cupid-fade-up .5s ease-out both" }}>
								<div style={{ ...SLIDE_LABEL, letterSpacing: ".18em", color: "#FF8FB1" }}>
									RULE 1 OF 2
								</div>
								<div
									style={{
										fontFamily: FONT_DISPLAY,
										fontSize: 40,
										fontWeight: 500,
										marginTop: 10,
										lineHeight: 1.08,
									}}
								>
									For applicants
								</div>
								<div
									style={{
										fontSize: 22,
										lineHeight: 1.55,
										color: "#CFC6E4",
										marginTop: 16,
										textWrap: "pretty",
									}}
								>
									Rank your top <span style={{ color: "#FF8FB1", fontWeight: 700 }}>6</span>{" "}
									preferences.
								</div>
							</div>
							<div
								style={{
									width: 238,
									flex: "none",
									padding: 16,
									borderRadius: 16,
									background: "rgba(255,255,255,.03)",
									border: "1px solid rgba(255,255,255,.07)",
									animation: "cupid-fade-up .5s ease-out .15s both",
								}}
							>
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 9,
										letterSpacing: ".14em",
										color: "#7A6E96",
										marginBottom: 9,
									}}
								>
									YOUR LIST
								</div>
								<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
									<div
										style={{
											display: "flex",
											gap: 8,
											alignItems: "center",
											padding: "6px 10px",
											borderRadius: 9,
											background: "rgba(255,92,147,.13)",
											border: "1px solid rgba(255,92,147,.32)",
										}}
									>
										<span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#FF5C93" }}>1</span>
										<span style={{ fontSize: 13, color: "#F6F2FC" }}>the one you want most</span>
									</div>
									<div
										style={{
											display: "flex",
											gap: 8,
											alignItems: "center",
											padding: "6px 10px",
											borderRadius: 9,
											background: "rgba(255,92,147,.08)",
											border: "1px solid rgba(255,92,147,.2)",
										}}
									>
										<span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#FF8FB1" }}>2</span>
										<span style={{ fontSize: 13, color: "#CFC6E4" }}>next best</span>
									</div>
									{[
										{ n: 3, border: ".13", color: "#544B70" },
										{ n: 4, border: ".10", color: "#453C60" },
										{ n: 5, border: ".09", color: "#3D3555" },
										{ n: 6, border: ".08", color: "#372F4D" },
									].map((row) => (
										<div
											key={row.n}
											style={{
												display: "flex",
												gap: 8,
												alignItems: "center",
												padding: "6px 10px",
												borderRadius: 9,
												border: `1px dashed rgba(255,255,255,${row.border})`,
											}}
										>
											<span style={{ fontFamily: FONT_MONO, fontSize: 11, color: row.color }}>
												{row.n}
											</span>
											<span style={{ fontSize: 13, color: row.color }}>up to you</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				)}

				{vm.isRulesB && (
					<div
						className="cupid-scroll"
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "20px 36px",
							overflowY: "auto",
							animation: "cupid-fade-in .4s ease-out both",
						}}
					>
						<div
							className="flex-col md:flex-row"
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 940,
								background: "rgba(255,255,255,.05)",
								border: "1px solid rgba(255,255,255,.10)",
								borderRadius: 22,
								padding: "30px 38px",
								display: "flex",
								gap: 36,
								alignItems: "center",
								boxShadow: "0 24px 70px rgba(0,0,0,.45)",
							}}
						>
							<div style={{ flex: 1, animation: "cupid-fade-up .5s ease-out both" }}>
								<div style={{ ...SLIDE_LABEL, letterSpacing: ".18em", color: "#C7ADFF" }}>
									RULE 2 OF 2
								</div>
								<div
									style={{
										fontFamily: FONT_DISPLAY,
										fontSize: 40,
										fontWeight: 500,
										marginTop: 10,
										lineHeight: 1.08,
									}}
								>
									For chairs
								</div>
								<div
									style={{
										fontSize: 20,
										lineHeight: 1.55,
										color: "#CFC6E4",
										marginTop: 14,
										textWrap: "pretty",
									}}
								>
									Rank <span style={{ color: "#C7ADFF", fontWeight: 700 }}>at least 200%</span> of
									your role&apos;s empty spots.
								</div>
								<div
									style={{
										display: "flex",
										gap: 9,
										marginTop: 12,
										fontFamily: FONT_MONO,
										fontSize: 12,
										color: "#C6BCDE",
									}}
								>
									<span
										style={{
											border: "1px solid rgba(255,255,255,.12)",
											borderRadius: 8,
											padding: "5px 11px",
										}}
									>
										1 seat → 2 names
									</span>
									<span
										style={{
											border: "1px solid rgba(255,255,255,.12)",
											borderRadius: 8,
											padding: "5px 11px",
										}}
									>
										2 seats → 4 names
									</span>
								</div>
								<div
									style={{
										fontSize: 16,
										lineHeight: 1.6,
										color: "#9E92BC",
										marginTop: 15,
										textWrap: "pretty",
									}}
								>
									Our algorithm aims for an impartial allocation that respects mutual preferences.{" "}
									<span style={{ color: "#FFC177" }}>
										If you rank too few applicants, your position may not be fully filled.
									</span>
								</div>
							</div>
							<div
								style={{
									width: 264,
									flex: "none",
									padding: "18px 16px",
									borderRadius: 16,
									background: "rgba(255,255,255,.03)",
									border: "1px solid rgba(255,255,255,.07)",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 11,
									animation: "cupid-fade-up .5s ease-out .15s both",
								}}
							>
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 9,
										letterSpacing: ".14em",
										color: "#7A6E96",
									}}
								>
									4 NAMES · 2 SEATS
								</div>
								<div
									style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}
								>
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 11,
											padding: "5px 11px",
											borderRadius: 999,
											background: "rgba(255,92,147,.15)",
											border: "1px solid rgba(255,92,147,.36)",
											color: "#FFD9E6",
										}}
									>
										1 · A
									</span>
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 11,
											padding: "5px 11px",
											borderRadius: 999,
											background: "rgba(255,255,255,.04)",
											border: "1px solid rgba(255,255,255,.10)",
											color: "#7A6E96",
											animation: "cupid-drift 4.2s ease-in-out infinite",
										}}
									>
										2 · B
									</span>
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 11,
											padding: "5px 11px",
											borderRadius: 999,
											background: "rgba(255,92,147,.15)",
											border: "1px solid rgba(255,92,147,.36)",
											color: "#FFD9E6",
										}}
									>
										3 · C
									</span>
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 11,
											padding: "5px 11px",
											borderRadius: 999,
											background: "rgba(255,255,255,.04)",
											border: "1px solid rgba(255,255,255,.10)",
											color: "#7A6E96",
											animation: "cupid-drift 4.2s ease-in-out .9s infinite",
										}}
									>
										4 · D
									</span>
								</div>
								<div
									style={{ fontSize: 11.5, color: "#6C6190", textAlign: "center", lineHeight: 1.5 }}
								>
									B and D prefer other roles
								</div>
								<svg width="14" height="19" viewBox="0 0 14 20" style={{ opacity: 0.5 }}>
									<path
										d="M7 1 V15 M2.5 10.5 L7 15 L11.5 10.5"
										style={{
											fill: "none",
											stroke: "#FF8FB1",
											strokeWidth: 1.6,
											strokeLinecap: "round",
											strokeLinejoin: "round",
										}}
									/>
								</svg>
								<div style={{ display: "flex", gap: 8 }}>
									{[
										{ label: "A", delay: ".3s" },
										{ label: "C", delay: ".55s" },
									].map((chip) => (
										<div
											key={chip.label}
											style={{
												width: 92,
												height: 44,
												borderRadius: 11,
												background:
													"linear-gradient(180deg,rgba(255,92,147,.24),rgba(255,61,130,.07))",
												border: "1px solid rgba(255,92,147,.45)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontFamily: FONT_MONO,
												fontSize: 12,
												color: "#FFE7EF",
												animation: `cupid-drop-in .6s ease-out ${chip.delay} both`,
											}}
										>
											{chip.label}
										</div>
									))}
								</div>
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 9,
										letterSpacing: ".1em",
										color: "#FF8FB1",
									}}
								>
									BOTH SEATS FILLED
								</div>
							</div>
						</div>
					</div>
				)}

				{vm.isCompare && (
					<div className="cupid-scroll" style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.82)" }}>
						<div
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 580,
								maxHeight: "100%",
								display: "flex",
								flexDirection: "column",
								background: "linear-gradient(180deg,rgba(42,22,66,.94),rgba(14,8,30,.95))",
								border: "1px solid rgba(255,92,147,.32)",
								borderRadius: 22,
								padding: "18px 26px 16px",
								boxShadow: "0 30px 90px rgba(0,0,0,.6)",
								animation: "cupid-fade-up .45s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<div style={{ ...SLIDE_LABEL, letterSpacing: ".18em", color: "#FF8FB1" }}>
									{"WAYNE'S LIST DECIDES"}
								</div>
								<div
									style={{
										marginLeft: "auto",
										fontFamily: FONT_MONO,
										fontSize: 9,
										fontWeight: 700,
										letterSpacing: ".16em",
										color: "#160A22",
										background: "linear-gradient(90deg,#FF8FB1,#FF3D82)",
										borderRadius: 5,
										padding: "3px 10px",
									}}
								>
									FULL
								</div>
							</div>
							<div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 5 }}>
								<div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 500 }}>
									{vm.compareTitle}
								</div>
								<div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#9E92BC" }}>
									{vm.compareseats}
								</div>
							</div>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 4,
									marginTop: 10,
									flex: "none",
								}}
							>
								{vm.compareRows.map((row) => (
									<Fragment key={row.n}>
										{row.arriving && (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 12,
													padding: "9px 15px",
													borderRadius: 13,
													background:
														"linear-gradient(90deg,rgba(255,61,130,.26),rgba(255,61,130,.06))",
													border: "1.5px solid #FF3D82",
													boxShadow: "0 0 30px rgba(255,61,130,.3)",
													animation: "cupid-slide-above .75s cubic-bezier(.2,.85,.2,1) both",
												}}
											>
												<span
													style={{
														fontFamily: FONT_MONO,
														fontSize: 13,
														color: "#FFD9E6",
														width: 24,
													}}
												>
													#{row.n}
												</span>
												<span style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: "#FFF" }}>
													{row.name}
												</span>
												<span
													style={{
														marginLeft: "auto",
														fontFamily: FONT_MONO,
														fontSize: 9,
														letterSpacing: ".11em",
														color: "#FFC2D6",
													}}
												>
													CONTESTER
												</span>
											</div>
										)}
										{row.holding && (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 12,
													padding: "9px 15px",
													borderRadius: 13,
													background: "rgba(255,92,147,.09)",
													border: "1px solid rgba(255,92,147,.34)",
													animation: "cupid-fade-up .5s ease-out both",
												}}
											>
												<span
													style={{
														fontFamily: FONT_MONO,
														fontSize: 13,
														color: "#FF8FB1",
														width: 24,
													}}
												>
													#{row.n}
												</span>
												<span style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: "#F6F2FC" }}>
													{row.name}
												</span>
												<span
													style={{
														marginLeft: "auto",
														fontFamily: FONT_MONO,
														fontSize: 9,
														letterSpacing: ".11em",
														color: "#9E92BC",
													}}
												>
													DEFENDER
												</span>
											</div>
										)}
										{row.other && (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 12,
													padding: "6px 15px",
													borderRadius: 13,
													border: "1px solid rgba(255,255,255,.07)",
													opacity: 0.4,
												}}
											>
												<span
													style={{
														fontFamily: FONT_MONO,
														fontSize: 12,
														color: "#7A6E96",
														width: 24,
													}}
												>
													#{row.n}
												</span>
												<span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#9E92BC" }}>
													{row.name}
												</span>
											</div>
										)}
										{row.cut && (
											<div
												style={{ display: "flex", alignItems: "center", gap: 9, margin: "1px 0" }}
											>
												<div
													style={{
														flex: 1,
														height: 1,
														background:
															"repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 6px,transparent 6px 12px)",
													}}
												/>
												<span
													style={{
														fontFamily: FONT_MONO,
														fontSize: 8.5,
														letterSpacing: ".13em",
														color: "#7A6E96",
													}}
												>
													CAPACITY
												</span>
												<div
													style={{
														flex: 1,
														height: 1,
														background:
															"repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 6px,transparent 6px 12px)",
													}}
												/>
											</div>
										)}
									</Fragment>
								))}
							</div>
							<div
								style={{
									flex: "none",
									marginTop: 10,
									paddingTop: 9,
									borderTop: "1px solid rgba(255,255,255,.08)",
									fontSize: 15.5,
									lineHeight: 1.4,
									color: "#FFD9E6",
									textWrap: "pretty",
									animation: "cupid-fade-up .6s ease-out .95s both",
								}}
							>
								{vm.compareVerdict}
							</div>
						</div>
					</div>
				)}

				{vm.isRC1 && (
					<div className="cupid-scroll" style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.84)" }}>
						<div
							style={{
								margin: "auto",
								textAlign: "center",
								animation: "cupid-fade-up .5s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div
								style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
							>
								<Heart
									size={22}
									fill="#FF3D82"
									style={{ animation: "cupid-heartbeat 2.6s ease-in-out infinite both" }}
								/>
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 10,
										letterSpacing: ".24em",
										color: "#FF8FB1",
									}}
								>
									ROUND ONE
								</div>
							</div>
							<div
								className="text-[34px] md:text-[52px]"
								style={{
									fontFamily: FONT_DISPLAY,
									fontWeight: 500,
									color: "#FFE7EF",
									marginTop: 12,
									lineHeight: 1.05,
								}}
							>
								First choices
							</div>
							<div style={{ fontSize: 19, color: "#9E92BC", marginTop: 12 }}>
								One by one, everyone proposes to the position they want most.
							</div>
						</div>
					</div>
				)}

				{vm.isRC2 && (
					<div className="cupid-scroll" style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.84)" }}>
						<div
							style={{
								margin: "auto",
								textAlign: "center",
								maxWidth: 660,
								animation: "cupid-fade-up .5s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div
								style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
							>
								<Heart
									size={22}
									fill="#A97BFF"
									style={{ animation: "cupid-heartbeat 2.6s ease-in-out infinite both" }}
								/>
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 10,
										letterSpacing: ".24em",
										color: "#C7ADFF",
									}}
								>
									ROUND TWO
								</div>
							</div>
							<div
								className="text-[34px] md:text-[52px]"
								style={{
									fontFamily: FONT_DISPLAY,
									fontWeight: 500,
									color: "#EFE6FF",
									marginTop: 12,
									lineHeight: 1.05,
								}}
							>
								Second choices
							</div>
							<div style={{ fontSize: 19, color: "#9E92BC", marginTop: 12, textWrap: "pretty" }}>
								Everyone proposes to the position they ranked second.
							</div>
						</div>
					</div>
				)}

				{vm.isResults && (
					<div className="cupid-scroll" style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.84)" }}>
						<div
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 620,
								background: "linear-gradient(180deg,rgba(40,22,64,.94),rgba(14,8,30,.95))",
								border: "1px solid rgba(255,92,147,.26)",
								borderRadius: 22,
								padding: "20px 30px",
								boxShadow: "0 30px 90px rgba(0,0,0,.6)",
								animation: "cupid-fade-up .5s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 9 }}>
								<Heart size={16} fill="#FF3D82" />
								<div
									style={{
										fontFamily: FONT_MONO,
										fontSize: 10,
										letterSpacing: ".2em",
										color: "#FF8FB1",
									}}
								>
									FINAL MATCHES
								</div>
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
								{[
									{
										role: "Programmes",
										who: "Raegan",
										bg: "rgba(255,92,147,.10)",
										bd: "rgba(255,92,147,.3)",
										fg: "#FFE7EF",
										delay: ".05s",
									},
									{
										role: "Marketing",
										who: "Danielle",
										bg: "rgba(169,123,255,.12)",
										bd: "rgba(169,123,255,.34)",
										fg: "#EFE6FF",
										delay: ".13s",
									},
									{
										role: "Logistics",
										who: "Alexis, Celeste",
										bg: "rgba(255,92,147,.10)",
										bd: "rgba(255,92,147,.3)",
										fg: "#FFE7EF",
										delay: ".21s",
									},
								].map((row) => (
									<div
										key={row.role}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 14,
											padding: "8px 15px",
											borderRadius: 12,
											background: row.bg,
											border: `1px solid ${row.bd}`,
											animation: `cupid-fade-up .5s ease-out ${row.delay} both`,
										}}
									>
										<span
											style={{
												fontFamily: FONT_DISPLAY,
												fontSize: 16,
												color: "#CFC6E4",
												width: 130,
											}}
										>
											{row.role}
										</span>
										<span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: row.fg }}>
											{row.who}
										</span>
									</div>
								))}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 14,
										padding: "8px 15px",
										borderRadius: 12,
										border: "1px dashed rgba(255,179,92,.45)",
										background: "rgba(255,179,92,.07)",
										animation: "cupid-fade-up .5s ease-out .29s both",
									}}
								>
									<span
										style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#CFC6E4", width: 130 }}
									>
										Publicity
									</span>
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 13,
											letterSpacing: ".1em",
											color: "#FFC177",
										}}
									>
										EMPTY
									</span>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 14,
										padding: "8px 15px",
										borderRadius: 12,
										border: "1px dashed rgba(255,255,255,.16)",
										animation: "cupid-fade-up .5s ease-out .37s both",
									}}
								>
									<span
										style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: "#9E92BC", width: 130 }}
									>
										No spot
									</span>
									<span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: "#9E92BC" }}>
										Amir
									</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{vm.isClose1 && (
					<div
						className="cupid-scroll"
						style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.88)", backdropFilter: "blur(8px)" }}
					>
						<div
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 680,
								animation: "cupid-fade-up .55s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div style={{ ...SLIDE_LABEL, color: "#FFC177" }}>THE EMPTY SEAT</div>
							<div
								className="text-[26px] md:text-[34px]"
								style={{
									fontFamily: FONT_DISPLAY,
									fontWeight: 400,
									lineHeight: 1.3,
									marginTop: 14,
									color: "#F6F2FC",
									textWrap: "pretty",
								}}
							>
								Wayne only ranked{" "}
								<span style={{ color: "#FFC177", fontWeight: 600 }}>one applicant</span> for
								Publicity: Raegan.
							</div>
							<div
								style={{
									fontSize: 20,
									lineHeight: 1.55,
									color: "#9E92BC",
									marginTop: 14,
									textWrap: "pretty",
									animation: "cupid-fade-up .6s ease-out .5s both",
								}}
							>
								As raegan is allocated Programmes in round 1, there are no remaining allocatable
								candidate for Publicity.
							</div>
						</div>
					</div>
				)}

				{vm.isClose2 && (
					<div
						className="cupid-scroll"
						style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.92)", backdropFilter: "blur(8px)" }}
					>
						<div style={{ margin: "auto", width: "100%", maxWidth: 720 }}>
							<div style={{ fontSize: 17, lineHeight: 1.55, color: "#6C6190", textWrap: "pretty" }}>
								As chairs, you should always aim to
							</div>
							<div
								style={{
									height: 1,
									background:
										"repeating-linear-gradient(90deg,rgba(255,92,147,.35) 0 7px,transparent 7px 14px)",
									margin: "24px 0",
								}}
							/>
							<div
								className="text-[30px] md:text-[42px]"
								style={{
									fontFamily: FONT_DISPLAY,
									fontWeight: 500,
									lineHeight: 1.25,
									color: "#FFE7EF",
									textWrap: "pretty",
									animation: "cupid-fade-up .7s cubic-bezier(.2,.85,.2,1) .25s both",
								}}
							>
								Rank at least{" "}
								<span
									style={{
										background: "linear-gradient(96deg,#FF8FB1,#A97BFF)",
										WebkitBackgroundClip: "text",
										backgroundClip: "text",
										color: "transparent",
									}}
								>
									200%
								</span>
								<br />
								of your empty seats.
							</div>
						</div>
					</div>
				)}

				{vm.isReplay && (
					<div
						className="cupid-scroll"
						style={{ ...OVERLAY_BASE, background: "rgba(9,5,22,.90)", backdropFilter: "blur(8px)" }}
					>
						<div
							style={{
								margin: "auto",
								width: "100%",
								maxWidth: 600,
								background: "linear-gradient(180deg,rgba(40,22,64,.94),rgba(14,8,30,.95))",
								border: "1px solid rgba(255,255,255,.10)",
								borderRadius: 22,
								padding: "18px 26px",
								boxShadow: "0 30px 90px rgba(0,0,0,.6)",
								animation: "cupid-fade-up .5s cubic-bezier(.2,.85,.2,1) both",
							}}
						>
							<div style={{ ...SLIDE_LABEL, color: "#FFC177" }}>IF TWO NAMES ARE PROVIDED</div>
							<div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 7 }}>
								<div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500 }}>
									Publicity
								</div>
								<div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#9E92BC" }}>
									1 seat · 2 names
								</div>
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "8px 15px",
										borderRadius: 12,
										border: "1px solid rgba(255,255,255,.07)",
										opacity: 0.5,
									}}
								>
									<span
										style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#7A6E96", width: 24 }}
									>
										#1
									</span>
									<span
										style={{
											fontFamily: FONT_DISPLAY,
											fontSize: 17,
											color: "#9E92BC",
											textDecoration: "line-through",
										}}
									>
										Raegan
									</span>
									<span
										style={{
											marginLeft: "auto",
											fontFamily: FONT_MONO,
											fontSize: 9,
											letterSpacing: ".09em",
											color: "#6C6190",
										}}
									>
										TAKEN · Programmes
									</span>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "8px 15px",
										borderRadius: 12,
										background: "linear-gradient(90deg,rgba(255,61,130,.22),rgba(255,61,130,.05))",
										border: "1.5px solid rgba(255,92,147,.6)",
										animation: "cupid-fade-up .5s ease-out .4s both",
									}}
								>
									<span
										style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#FFD9E6", width: 24 }}
									>
										#2
									</span>
									<span style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: "#FFF" }}>
										Amir
									</span>
									<span
										style={{
											marginLeft: "auto",
											fontFamily: FONT_MONO,
											fontSize: 9,
											letterSpacing: ".09em",
											color: "#FFC2D6",
										}}
									>
										FREE
									</span>
								</div>
							</div>
							<div style={{ display: "flex", justifyContent: "center", margin: "9px 0 7px" }}>
								<svg width="14" height="18" viewBox="0 0 14 22" style={{ opacity: 0.6 }}>
									<path
										d="M7 1 V16 M2.5 11.5 L7 16 L11.5 11.5"
										style={{
											fill: "none",
											stroke: "#FF8FB1",
											strokeWidth: 1.7,
											strokeLinecap: "round",
											strokeLinejoin: "round",
										}}
									/>
								</svg>
							</div>
							<div style={{ display: "flex", justifyContent: "center" }}>
								<div
									style={{
										width: 146,
										height: 46,
										borderRadius: 12,
										background: "linear-gradient(180deg,rgba(255,92,147,.26),rgba(255,61,130,.08))",
										border: "1px solid rgba(255,92,147,.55)",
										boxShadow: "0 0 28px rgba(255,61,130,.3)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: 7,
										animation: "cupid-drop-in .8s cubic-bezier(.2,.85,.2,1) .9s both",
									}}
								>
									<Heart size={13} fill="#FF8FB1" />
									<span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: "#FFE7EF" }}>
										Amir
									</span>
								</div>
							</div>
							<div
								style={{
									fontSize: 15,
									lineHeight: 1.5,
									color: "#9E92BC",
									marginTop: 13,
									textAlign: "center",
									textWrap: "pretty",
									animation: "cupid-fade-up .6s ease-out 1.5s both",
								}}
							>
								A second option would have allowed this seat to be filled.
							</div>
						</div>
					</div>
				)}
			</div>

			{vm.showRule && (
				<div style={{ position: "relative", zIndex: 1, padding: "7px 20px 0", flex: "none" }}>
					<div
						style={{
							borderRadius: 14,
							border: "1px solid rgba(255,92,147,.22)",
							background: "linear-gradient(90deg,rgba(255,61,130,.11),rgba(169,123,255,.05))",
							padding: "10px 17px",
							display: "flex",
							gap: 14,
							alignItems: "center",
							minHeight: 44,
						}}
					>
						<span
							style={{
								fontFamily: FONT_MONO,
								fontSize: 9,
								letterSpacing: ".16em",
								color: "#FF8FB1",
								flex: "none",
							}}
						>
							DESCRIPTION
						</span>
						<span
							style={{ fontSize: 16.5, color: "#F6F2FC", lineHeight: 1.35, textWrap: "pretty" }}
						>
							{vm.caption}
						</span>
					</div>
				</div>
			)}

			<div
				style={{
					position: "relative",
					zIndex: 1,
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "10px 20px 14px",
					flex: "none",
				}}
			>
				<button
					type="button"
					onClick={() => go(-1)}
					className="cupid-btn-ghost"
					style={{
						border: "1px solid rgba(255,255,255,.14)",
						background: "rgba(255,255,255,.04)",
						color: "#CFC6E4",
						fontSize: 14,
						fontWeight: 600,
						padding: "11px 20px",
						borderRadius: 11,
						cursor: "pointer",
						fontFamily: "inherit",
					}}
				>
					Back
				</button>
				<button
					type="button"
					onClick={() => go(1)}
					className="cupid-btn-primary"
					style={{
						border: "none",
						background: "linear-gradient(96deg,#FF3D82,#FF6FA0)",
						color: "#1A0A20",
						fontSize: 16,
						fontWeight: 700,
						padding: "13px 34px",
						borderRadius: 12,
						boxShadow: "0 8px 26px rgba(255,61,130,.34)",
						cursor: "pointer",
						fontFamily: "inherit",
					}}
				>
					{vm.nextLabel}
				</button>
				<div className="hidden md:flex" style={{ gap: 4, alignItems: "center", marginLeft: 6 }}>
					{vm.ticks.map((tick, ix) => (
						<span
							key={ix}
							style={{
								width: 15,
								height: 3,
								borderRadius: 9,
								background: tick.d2 ? "#A97BFF" : tick.d1 ? "#FF5C93" : "rgba(255,255,255,.13)",
								boxShadow: tick.d2
									? "0 0 7px rgba(169,123,255,.6)"
									: tick.d1
										? "0 0 7px rgba(255,61,130,.6)"
										: undefined,
							}}
						/>
					))}
				</div>
				<div
					className="hidden sm:block"
					style={{
						marginLeft: "auto",
						fontFamily: FONT_MONO,
						fontSize: 9,
						letterSpacing: ".1em",
						color: "#544B70",
					}}
				>
					← → TO STEP
				</div>
			</div>
		</div>
	);
}
