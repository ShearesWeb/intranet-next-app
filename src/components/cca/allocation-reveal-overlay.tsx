"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Pointer } from "lucide-react";

import { CcaTypeBadge, PositionTypeBadge } from "@/components/badges";
import type { AllocationReveal, RevealSlot } from "@/lib/cca/allocation-reveal";

const FONT_DISPLAY = "var(--font-fredoka), sans-serif";
const FONT_MONO = "var(--font-geist-mono), monospace";

/** Fraction of the envelope width the swipe has to cover to count as a cut. */
const CUT_DONE = 0.72;
/** Fraction of the envelope width that maps to a full cut, so the swipe ends early. */
const CUT_TRAVEL = 0.78;
const OPEN_DELAY = 1250;
const SLOT_GAP = 2500;
const RESOLVE_AT = 1600;
const DONE_PADDING = 900;

type Stage = "sealed" | "opening" | "revealing" | "done";

interface AllocationRevealOverlayProps {
	reveal: AllocationReveal;
	onClose: () => void;
}

/** One reveal step: an appointment card, or the single consolation card. */
type Step = { kind: "slot"; slot: RevealSlot } | { kind: "consolation" };

function buildSteps(reveal: AllocationReveal): Step[] {
	if (reveal.outcome === "none") return [{ kind: "consolation" }];
	return reveal.slots.map((slot) => ({ kind: "slot", slot }));
}

/**
 * Deterministic confetti — no `Math.random`, so a re-render never reshuffles
 * pieces mid-flight.
 */
function confettiPieces() {
	const colors = ["#f97316", "#fb923c", "#fdba74", "#fff7ed", "#f59e0b"];
	return Array.from({ length: 46 }, (_, i) => {
		const round = i % 3 === 0;
		return {
			id: i,
			style: {
				position: "absolute",
				top: "-8vh",
				left: `${(i * 2.27 + (i % 7) * 3.1) % 100}%`,
				width: round ? 6 : 8,
				height: round ? 12 : 8,
				borderRadius: round ? "2px" : "50%",
				background: colors[i % colors.length],
				["--reveal-dx" as string]: `${((i * 37) % 150) - 75}px`,
				["--reveal-rot" as string]: `${(i % 5) * 180 + 240}deg`,
				animation: `reveal-confetti ${2.6 + (i % 5) * 0.45}s cubic-bezier(.2,.6,.4,1) ${
					(i % 11) * 0.16
				}s forwards`,
			} as CSSProperties,
		};
	});
}

export function AllocationRevealOverlay({ reveal, onClose }: AllocationRevealOverlayProps) {
	const steps = useMemo(() => buildSteps(reveal), [reveal]);

	const [mounted, setMounted] = useState(false);
	const [stage, setStage] = useState<Stage>("sealed");
	const [cut, setCut] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [nudges, setNudges] = useState(0);
	/** How many steps have appeared as pending shimmer placeholders. */
	const [shown, setShown] = useState(0);
	/** How many of those have resolved into their card. */
	const [resolved, setResolved] = useState(0);

	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const dragOrigin = useRef(0);
	const envelopeWidth = useRef(480);

	const clearTimers = useCallback(() => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	}, []);

	useEffect(() => setMounted(true), []);
	useEffect(() => clearTimers, [clearTimers]);

	// The reveal owns the whole viewport while it runs.
	useEffect(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	const beginOpen = useCallback(() => {
		clearTimers();
		setStage("opening");
		setDragging(false);
		setCut(1);

		const queue: ReturnType<typeof setTimeout>[] = [
			setTimeout(() => setStage("revealing"), OPEN_DELAY - 100),
		];
		steps.forEach((_, index) => {
			queue.push(setTimeout(() => setShown(index + 1), OPEN_DELAY + index * SLOT_GAP));
			queue.push(
				setTimeout(() => setResolved(index + 1), OPEN_DELAY + index * SLOT_GAP + RESOLVE_AT),
			);
		});
		queue.push(
			setTimeout(
				() => setStage("done"),
				OPEN_DELAY + (steps.length - 1) * SLOT_GAP + RESOLVE_AT + DONE_PADDING,
			),
		);
		timers.current = queue;
	}, [clearTimers, steps]);

	const replay = useCallback(() => {
		clearTimers();
		setStage("sealed");
		setCut(0);
		setDragging(false);
		setNudges(0);
		setShown(0);
		setResolved(0);
	}, [clearTimers]);

	const onCutStart = (event: React.PointerEvent<HTMLDivElement>) => {
		if (stage !== "sealed") return;
		dragOrigin.current = event.clientX;
		envelopeWidth.current = event.currentTarget.getBoundingClientRect().width || 480;
		event.currentTarget.setPointerCapture?.(event.pointerId);
		setDragging(true);
		setCut(0);
	};

	const onCutMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!dragging || stage !== "sealed") return;
		const travelled = (event.clientX - dragOrigin.current) / (envelopeWidth.current * CUT_TRAVEL);
		const next = Math.max(0, Math.min(1, travelled));
		setCut(next);
		if (next >= 1) beginOpen();
	};

	const onCutEnd = () => {
		if (stage !== "sealed" || !dragging) return;
		if (cut >= CUT_DONE) {
			beginOpen();
			return;
		}
		// Not far enough — snap back and nudge, so the gesture reads as unfinished
		// rather than broken.
		setDragging(false);
		setCut(0);
		setNudges((count) => count + 1);
	};

	if (!mounted) return null;

	const sealed = stage === "sealed";
	const opening = stage === "opening";
	const afterOpen = stage === "revealing" || stage === "done";
	const done = stage === "done";
	const cutPct = `${Math.round(Math.min(1, cut) * 100)}%`;
	const showConfetti = reveal.outcome === "allocated" && resolved > 0;

	const envelopeStyle: CSSProperties = {
		position: "relative",
		width: "min(520px, 86vw)",
		height: "min(320px, 54vw)",
		borderRadius: 14,
		overflow: "hidden",
		cursor: sealed ? "ew-resize" : "default",
		background: "linear-gradient(180deg,#fdf6ea,#f3e3cb)",
		boxShadow: "0 30px 70px rgba(0,0,0,.45), inset 0 0 0 1px rgba(120,72,32,.16)",
		touchAction: "none",
		userSelect: "none",
		animation: opening
			? "reveal-envelope-open .95s cubic-bezier(.4,0,.6,1) .28s both"
			: nudges > 0 && sealed
				? "reveal-nudge .32s ease-in-out both"
				: "none",
	};

	const sealHalf = (side: "left" | "right"): CSSProperties => ({
		position: "absolute",
		top: 0,
		bottom: 0,
		width: 52,
		left: side === "left" ? 0 : "auto",
		right: side === "right" ? 0 : "auto",
		borderRadius: side === "left" ? "52px 0 0 52px" : "0 52px 52px 0",
		background:
			side === "left"
				? "radial-gradient(circle at 80% 30%,#ffb057,#ea580c 70%,#9a3412)"
				: "radial-gradient(circle at 20% 30%,#ff9d3d,#d9480f 70%,#7c2d12)",
		boxShadow: "0 10px 26px rgba(154,52,18,.45)",
		animation: opening ? `reveal-seal-${side} .8s cubic-bezier(.3,.1,.6,1) .18s both` : "none",
	});

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label={`${reveal.periodLabel} allocation results`}
			style={{ position: "fixed", inset: 0, zIndex: 60, overflowX: "hidden", overflowY: "auto" }}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: "radial-gradient(120% 90% at 50% 0%,#3a1c07 0%,#1d0f05 55%,#110903 100%)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					top: -120,
					right: -90,
					width: 420,
					height: 420,
					borderRadius: 9999,
					background: "rgba(249,115,22,.35)",
					filter: "blur(90px)",
					animation: "reveal-blob 6s ease-in-out infinite",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: -140,
					left: -100,
					width: 460,
					height: 460,
					borderRadius: 9999,
					background: "rgba(245,158,11,.28)",
					filter: "blur(100px)",
					animation: "reveal-blob-alt 7s ease-in-out 1s infinite",
				}}
			/>
			{showConfetti && (
				<div
					aria-hidden
					style={{
						position: "absolute",
						inset: 0,
						overflow: "hidden",
						pointerEvents: "none",
						zIndex: 3,
					}}
				>
					{confettiPieces().map((piece) => (
						<span key={piece.id} style={piece.style} />
					))}
				</div>
			)}

			<button
				type="button"
				onClick={onClose}
				style={{
					position: "absolute",
					top: 16,
					right: 16,
					zIndex: 6,
					border: "1px solid rgba(255,255,255,.18)",
					borderRadius: 9999,
					padding: "6px 14px",
					background: "rgba(255,255,255,.08)",
					backdropFilter: "blur(6px)",
					color: "rgba(255,255,255,.82)",
					fontSize: 12,
					fontWeight: 600,
					cursor: "pointer",
				}}
			>
				Skip
			</button>

			<div
				style={{
					position: "relative",
					zIndex: 4,
					minHeight: "100svh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "72px 16px 40px",
					gap: 24,
				}}
			>
				{(sealed || opening) && (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 26,
							animation: "reveal-fade-up-lg .5s ease-out both",
						}}
					>
						<div
							role="button"
							tabIndex={0}
							aria-label="Open your allocation envelope"
							onPointerDown={onCutStart}
							onPointerMove={onCutMove}
							onPointerUp={onCutEnd}
							onPointerCancel={onCutEnd}
							onPointerLeave={onCutEnd}
							onKeyDown={(event) => {
								if (stage !== "sealed") return;
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									beginOpen();
								}
							}}
							style={envelopeStyle}
						>
							<div
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									top: 0,
									height: "52%",
									background: "linear-gradient(180deg,#f5e7d3,#efdcc2)",
									clipPath: "polygon(0 0,100% 0,50% 100%)",
									transformOrigin: "top center",
									boxShadow: "0 2px 6px rgba(0,0,0,.06)",
									zIndex: 2,
								}}
							/>
							<div
								style={{
									position: "absolute",
									inset: 0,
									background: "linear-gradient(180deg,rgba(255,255,255,.4),rgba(0,0,0,.04))",
								}}
							/>
							<div
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									bottom: 0,
									height: "56%",
									background: "linear-gradient(180deg,#fdf3e5,#f6e6cf)",
									clipPath: "polygon(0 100%,100% 100%,100% 0,50% 40%,0 0)",
									zIndex: 3,
								}}
							/>
							<div
								style={{
									position: "absolute",
									left: 26,
									right: 26,
									top: "50%",
									transform: "translateY(-50%)",
									zIndex: 5,
									display: "flex",
									alignItems: "center",
									height: 22,
								}}
							>
								<span
									style={{
										position: "absolute",
										left: 0,
										right: 0,
										height: 0,
										borderTop: "2px dashed rgba(120,72,32,.35)",
									}}
								/>
								<span
									style={{
										position: "absolute",
										left: 0,
										top: "50%",
										transform: "translateY(-50%)",
										height: 3,
										borderRadius: 2,
										background: "linear-gradient(90deg,#c2410c,#f97316)",
										width: cutPct,
										boxShadow: "0 0 14px rgba(249,115,22,.6)",
									}}
								/>
								<span
									style={{
										position: "absolute",
										left: cutPct,
										top: "50%",
										transform: "translate(-50%,-50%)",
										width: 14,
										height: 14,
										borderRadius: 9999,
										background: "#fff7ed",
										border: "2px solid #ea580c",
										opacity: dragging ? 1 : 0,
									}}
								/>
							</div>
							<div
								style={{
									position: "absolute",
									left: "50%",
									top: "50%",
									transform: "translate(-50%,-50%)",
									zIndex: 6,
									width: 104,
									height: 104,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									pointerEvents: "none",
								}}
							>
								<span style={sealHalf("left")} />
								<span style={sealHalf("right")} />
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src="/images/shweb-logo.png"
									alt=""
									style={{
										position: "relative",
										zIndex: 2,
										width: 60,
										height: 60,
										borderRadius: 9999,
										objectFit: "cover",
										opacity: opening ? 0 : 1,
									}}
								/>
							</div>
							{/* The pointer demo is a prompt, not a companion — once the
							    resident is cutting, it gets out of the way. */}
							{sealed && !dragging && (
								<div
									aria-hidden
									style={{
										position: "absolute",
										left: 0,
										right: 0,
										top: "50%",
										transform: "translateY(-50%)",
										zIndex: 7,
										pointerEvents: "none",
										overflow: "hidden",
										height: 60,
									}}
								>
									<span
										style={{
											position: "absolute",
											left: 36,
											top: "50%",
											height: 2,
											width: 300,
											transformOrigin: "left center",
											background: "linear-gradient(90deg,#f97316,rgba(249,115,22,0))",
											animation: "reveal-hand-trail 2.6s ease-out infinite",
										}}
									/>
									<span
										style={{
											position: "absolute",
											left: 36,
											top: "calc(50% - 17px)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											width: 34,
											height: 34,
											borderRadius: 9999,
											background: "rgba(249,115,22,.35)",
											border: "1px solid #f97316",
											boxShadow: "0 0 16px rgba(249,115,22,.55)",
											color: "#c2410c",
											animation: "reveal-hand 2.6s ease-out infinite",
										}}
									>
										<Pointer style={{ width: 18, height: 18 }} />
									</span>
								</div>
							)}
						</div>

						{sealed && (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 14,
									textAlign: "center",
								}}
							>
								<h1
									style={{
										margin: 0,
										maxWidth: "24ch",
										fontFamily: FONT_DISPLAY,
										fontWeight: 600,
										fontSize: "clamp(32px, 6vw, 46px)",
										lineHeight: 1.06,
										color: "#fff",
									}}
								>
									Your allocations are ready.
								</h1>
								<p
									style={{
										margin: 0,
										maxWidth: "42ch",
										fontSize: 17,
										lineHeight: 1.65,
										color: "rgba(255,255,255,.78)",
									}}
								>
									Open the envelope to see what positions you got for{" "}
									<strong style={{ color: "#fdba74" }}>{reveal.periodLabel}</strong>.
								</p>
								<span
									style={{
										fontFamily: FONT_MONO,
										fontSize: 11,
										letterSpacing: ".26em",
										textTransform: "uppercase",
										color: "rgba(255,255,255,.42)",
									}}
								>
									{nudges > 0 && cut === 0
										? "keep going — swipe all the way across"
										: "drag left to right"}
								</span>
							</div>
						)}
					</div>
				)}

				{afterOpen && (
					<div
						style={{
							width: "100%",
							maxWidth: 620,
							display: "flex",
							flexDirection: "column",
							gap: 16,
						}}
					>
						<div
							style={{
								textAlign: "center",
								animation: "reveal-fade-in-up .5s ease-out both",
							}}
						>
							<span
								style={{
									fontFamily: FONT_MONO,
									fontSize: 11,
									letterSpacing: ".32em",
									textTransform: "uppercase",
									color: "rgba(255,255,255,.5)",
								}}
							>
								{reveal.periodLabel} results
							</span>
						</div>

						{steps.map((step, index) => {
							if (index >= shown) return null;
							if (index >= resolved) {
								return (
									<div
										key={step.kind === "slot" ? step.slot.key : "consolation"}
										style={{
											borderRadius: 20,
											border: "1px solid rgba(255,255,255,.14)",
											background:
												"linear-gradient(90deg,rgba(255,255,255,.05) 20%,rgba(255,255,255,.13) 50%,rgba(255,255,255,.05) 80%)",
											backgroundSize: "220% 100%",
											animation:
												"reveal-slot-in .45s ease-out both, reveal-shimmer 1.5s linear infinite",
											padding: "28px 26px",
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 16,
										}}
									>
										<span
											style={{
												fontFamily: FONT_MONO,
												fontSize: 12,
												letterSpacing: ".26em",
												textTransform: "uppercase",
												color: "rgba(255,255,255,.55)",
											}}
										>
											{steps.length === 1 ? "Result" : `Result ${index + 1} of ${steps.length}`}
										</span>
										<span style={{ display: "flex", gap: 6 }} aria-hidden>
											{[0, 0.18, 0.36].map((delay) => (
												<span
													key={delay}
													style={{
														width: 7,
														height: 7,
														borderRadius: 9999,
														background: "#fdba74",
														animation: `reveal-dots 1.1s ease-in-out ${delay}s infinite`,
													}}
												/>
											))}
										</span>
									</div>
								);
							}

							return step.kind === "slot" ? (
								<RevealCard key={step.slot.key} slot={step.slot} />
							) : (
								<ConsolationCard key="consolation" reveal={reveal} />
							);
						})}

						{done && reveal.hasLaterRound && reveal.outcome === "allocated" && (
							<p
								style={{
									margin: "2px 0 0",
									textAlign: "center",
									fontSize: 14,
									color: "rgba(255,255,255,.62)",
								}}
							>
								Subcomm round opens later soon.
							</p>
						)}

						{done && (
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									justifyContent: "center",
									gap: 10,
									marginTop: 6,
									animation: "reveal-fade-in .4s ease-out both",
								}}
							>
								<button
									type="button"
									onClick={onClose}
									style={{
										display: "inline-flex",
										alignItems: "center",
										height: 44,
										padding: "0 24px",
										border: 0,
										borderRadius: 9999,
										background: "#fff",
										color: "#c2410c",
										fontSize: 15,
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Continue to My CCAs
								</button>
								<button
									type="button"
									onClick={replay}
									style={{
										display: "inline-flex",
										alignItems: "center",
										height: 44,
										padding: "0 22px",
										border: "1px solid rgba(255,255,255,.28)",
										borderRadius: 9999,
										background: "transparent",
										color: "#fff",
										fontSize: 15,
										fontWeight: 600,
										cursor: "pointer",
									}}
								>
									Replay
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}

function RevealCard({ slot }: { slot: RevealSlot }) {
	return (
		<div
			style={{
				position: "relative",
				background: "#fff",
				borderRadius: 20,
				padding: "22px 24px",
				boxShadow: "0 18px 44px rgba(0,0,0,.34)",
				animation: "reveal-card-settle .66s cubic-bezier(.2,.7,.3,1) both",
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
				<CcaTypeBadge value={slot.ccaKind} className="text-xs" />
				{slot.revealedEarlier && (
					<span
						style={{
							fontFamily: FONT_MONO,
							fontSize: 10,
							letterSpacing: ".18em",
							textTransform: "uppercase",
							color: "oklch(0.5555 0 0)",
						}}
					>
						Revealed earlier
					</span>
				)}
			</div>
			<span
				style={{
					fontFamily: FONT_DISPLAY,
					fontSize: "clamp(24px, 4vw, 30px)",
					lineHeight: 1.12,
					color: "oklch(0.3485 0 0)",
				}}
			>
				{slot.name}
			</span>
			<span
				style={{
					fontFamily: FONT_DISPLAY,
					fontSize: "clamp(32px, 6vw, 44px)",
					lineHeight: 1,
					color: "#ea580c",
				}}
			>
				{slot.position}
			</span>
			<span style={{ alignSelf: "flex-start" }}>
				<PositionTypeBadge
					value={slot.positionType}
					positionType={slot.positionType}
					className="text-xs"
				/>
			</span>
			{slot.description && (
				<p
					style={{
						margin: "6px 0 0",
						fontSize: 14,
						lineHeight: 1.6,
						color: "oklch(0.5555 0 0)",
						textWrap: "pretty",
					}}
				>
					{slot.description}
				</p>
			)}
		</div>
	);
}

function ConsolationCard({ reveal }: { reveal: AllocationReveal }) {
	const consolation = reveal.consolation;
	if (!consolation) return null;

	const paragraph: CSSProperties = {
		margin: 0,
		maxWidth: "40ch",
		fontSize: 16,
		lineHeight: 1.7,
		color: "oklch(0.5555 0 0)",
		textWrap: "pretty",
	};

	return (
		<div
			style={{
				background: "oklch(0.9856 0.0084 56.3169)",
				borderRadius: 24,
				padding: "32px 24px",
				boxShadow: "0 22px 60px rgba(0,0,0,.36)",
				textAlign: "center",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 14,
				animation: "reveal-card-settle .66s cubic-bezier(.2,.7,.3,1) both",
			}}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src="/images/shweb-logo.png"
				alt=""
				style={{
					width: 72,
					height: 72,
					borderRadius: 9999,
					objectFit: "cover",
					boxShadow: "0 6px 18px rgba(234,88,12,.28)",
				}}
			/>
			<h2
				style={{
					margin: "4px 0 0",
					fontFamily: FONT_DISPLAY,
					fontWeight: 600,
					fontSize: "clamp(27px, 5vw, 36px)",
					lineHeight: 1.1,
					color: "oklch(0.3485 0 0)",
					textWrap: "pretty",
				}}
			>
				{consolation.title}
			</h2>
			<p style={paragraph}>{consolation.body}</p>
			<p style={paragraph}>{consolation.followUp}</p>
			{consolation.closer && <p style={paragraph}>{consolation.closer}</p>}
		</div>
	);
}
