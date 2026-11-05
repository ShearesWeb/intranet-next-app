"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	CLAIM_STATUS_STYLE,
	FACILITY_CARD_CLASS,
	LegendItem,
	WithdrawConfirm,
} from "@/components/facilities/facility-ui";
import { type MyClaim } from "@/hooks/use-my-facility-claims";
import {
	ClaimSegment,
	GRID_HOURS,
	GRID_SLOT_COUNT,
	GridClaim,
	NEXT_DAY_COLUMN,
	columnOfHour,
	dayOfMonth,
	facilityLabel,
	formatClock,
	formatDayLabel,
	formatDuration,
	formatHourSpan,
	formatWeekRange,
	groupClaimSegments,
	isSlotPast,
	weekdayLabel,
	cellKey,
} from "@/lib/facilities/booking-grid";
import { type BookingCca } from "@/lib/facilities/booking-eligibility";
import { errorMessage, requestVenue, withdrawBooking } from "@/lib/facilities/facility-client";
import {
	BOOKING_WEEKS_AHEAD,
	getSingaporeDateKey,
	getSingaporeHour,
	type NusAcademicWeek,
} from "@/lib/nus-academic-calendar";
import { cn } from "@/lib/utils";
import { Facility, FacilitySlot } from "@/types/facilities";

const ROW_HEIGHT = 34;

interface Selection {
	facilityId: number;
	start: number;
	end: number;
}

type DragMode = "create" | "move" | "start" | "end";

interface BookCalendarProps {
	weeks: NusAcademicWeek[];
	weekIndex: number;
	day: string;
	onWeekChange: (index: number) => void;
	onDayChange: (day: string) => void;
	facilities: Facility[];
	slots: FacilitySlot[];
	myClaims: MyClaim[];
	bookingCcas: BookingCca[];
	isJcrc: boolean;
	/** False until booking access resolves, so a booker never sees the resident rail flash. */
	userReady: boolean;
	onChanged: () => Promise<unknown>;
}

/** How many different CCAs hold a claim across columns [start, end). */
function countCcas(start: number, end: number, claimsAt: (column: number) => GridClaim[]): number {
	const ccas = new Set<number>();
	for (let column = start; column < end; column++) {
		for (const claim of claimsAt(column)) ccas.add(claim.cca_id);
	}
	return ccas.size;
}

const MINE_CHIP_CLASS = {
	approved: "border-solid border-primary bg-primary text-white",
	rejected: "border-solid border-fac-danger-line bg-fac-danger text-fac-danger-ink",
	pending: "border-dashed border-primary bg-fac-tint text-fac-ink",
};

export function BookCalendar({
	weeks,
	weekIndex,
	day,
	onWeekChange,
	onDayChange,
	facilities,
	slots,
	myClaims,
	bookingCcas,
	isJcrc,
	userReady,
	onChanged,
}: BookCalendarProps) {
	const canRequest = bookingCcas.length > 0;
	const week = weeks[weekIndex];
	const today = getSingaporeDateKey();
	const currentHour = getSingaporeHour();

	const [selection, setSelection] = useState<Selection | null>(null);
	const [pickedClaimId, setPickedClaimId] = useState<number | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [chosenCcaId, setChosenCcaId] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	// Opening the panel narrows the grid, which would slide the columns out from
	// under the cursor mid-drag, so it waits until the first drag ends.
	const [creating, setCreating] = useState(false);

	const dragMode = useRef<DragMode | null>(null);
	const anchor = useRef<{ facilityId: number; column: number } | null>(null);
	const grabOffset = useRef(0);
	const pressedWithMouse = useRef(false);
	const asideRef = useRef<HTMLElement>(null);

	const myCcaIds = useMemo(() => new Set(bookingCcas.map((cca) => cca.id)), [bookingCcas]);

	// One view of the week: who is on what. The slots know about every CCA and the
	// claims endpoint adds this user's declined requests.
	const { openCells, liveByCell, weekClaims } = useMemo(() => {
		const open = new Set<string>();
		const live = new Map<string, GridClaim[]>();
		const byId = new Map<number, GridClaim>();

		for (const slot of slots) {
			const column = columnOfHour(slot.hour);
			if (column < 0) continue;
			open.add(cellKey(slot.facility_id, slot.date, column));
			for (const claim of slot.claims) {
				byId.set(claim.claim_id, {
					claim_id: claim.claim_id,
					facility_id: slot.facility_id,
					date: slot.date,
					hour: slot.hour,
					cca_id: claim.cca_id,
					cca_name: claim.cca_name,
					status: claim.status,
				});
			}
		}
		for (const claim of myClaims) {
			if (week && claim.date >= week.start && claim.date <= week.end) {
				byId.set(claim.claim_id, claim);
			}
		}
		for (const claim of byId.values()) {
			if (claim.status === "rejected") continue;
			const key = cellKey(claim.facility_id, claim.date, columnOfHour(claim.hour));
			live.set(key, [...(live.get(key) ?? []), claim]);
		}
		return { openCells: open, liveByCell: live, weekClaims: [...byId.values()] };
	}, [slots, myClaims, week]);

	const claimsAt = useCallback(
		(facilityId: number, date: string, column: number) =>
			liveByCell.get(cellKey(facilityId, date, column)) ?? [],
		[liveByCell],
	);
	const isBooked = useCallback(
		(facilityId: number, date: string, column: number) =>
			claimsAt(facilityId, date, column).some((claim) => claim.status === "approved"),
		[claimsAt],
	);
	const othersPending = useCallback(
		(facilityId: number, date: string, column: number, excludeCcaId?: number) =>
			claimsAt(facilityId, date, column).filter(
				(claim) =>
					claim.status === "pending" &&
					!myCcaIds.has(claim.cca_id) &&
					claim.cca_id !== excludeCcaId,
			),
		[claimsAt, myCcaIds],
	);
	const givenAway = useCallback(
		(segment: ClaimSegment) => {
			for (let column = segment.start; column < segment.end; column++) {
				if (isBooked(segment.facility_id, segment.date, column)) return true;
			}
			return false;
		},
		[isBooked],
	);

	const canBook = useCallback(
		(facilityId: number, column: number) =>
			canRequest &&
			column >= 0 &&
			column < GRID_SLOT_COUNT &&
			openCells.has(cellKey(facilityId, day, column)) &&
			!isSlotPast(day, column, today, currentHour) &&
			!isBooked(facilityId, day, column) &&
			!claimsAt(facilityId, day, column).some((claim) => myCcaIds.has(claim.cca_id)),
		[canRequest, openCells, day, today, currentHour, isBooked, claimsAt, myCcaIds],
	);

	const mySegments = useMemo(
		() =>
			groupClaimSegments(weekClaims.filter((claim) => myCcaIds.has(claim.cca_id))).filter(
				(segment) => !(segment.status === "rejected" && givenAway(segment)),
			),
		[weekClaims, myCcaIds, givenAway],
	);
	const picked = useMemo(
		() =>
			pickedClaimId === null
				? null
				: (mySegments.find((segment) => segment.claim_ids.includes(pickedClaimId)) ?? null),
		[mySegments, pickedClaimId],
	);

	const facilityName = useCallback(
		(facilityId: number) => {
			const facility = facilities.find((candidate) => candidate.id === facilityId);
			return facility ? facilityLabel(facility) : "";
		},
		[facilities],
	);

	useEffect(() => {
		function endDrag() {
			dragMode.current = null;
			anchor.current = null;
			setCreating(false);
		}
		window.addEventListener("pointerup", endDrag);
		return () => window.removeEventListener("pointerup", endDrag);
	}, []);

	// Esc backs out one layer: the new selection first, then an open booking.
	const hasSelection = selection !== null;
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			if (hasSelection) {
				setSelection(null);
			} else {
				setPickedClaimId(null);
				setConfirming(false);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [hasSelection]);

	// On a phone the panel sits below the grid, out of sight of the tap that opened it.
	const panelOpen = (Boolean(selection) && !creating) || Boolean(picked);
	useEffect(() => {
		if (panelOpen && window.innerWidth < 1024) {
			asideRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
		}
	}, [panelOpen]);

	function clearPanels() {
		setSelection(null);
		setPickedClaimId(null);
		setConfirming(false);
	}

	function selectDay(next: string) {
		clearPanels();
		onDayChange(next);
	}

	function goToWeek(index: number) {
		if (index < 0 || index >= weeks.length) return;
		const offset = week.dates.indexOf(day);
		const target = weeks[index].dates[Math.max(offset, 0)];
		clearPanels();
		onWeekChange(index);
		onDayChange(target < today && weeks[index].dates.includes(today) ? today : target);
	}

	function beginSelection(facilityId: number, column: number) {
		setSelection({ facilityId, start: column, end: column + 1 });
		setPickedClaimId(null);
		setConfirming(false);
	}

	function columnAtPointer(event: React.PointerEvent, element: Element): number {
		const rect = element.getBoundingClientRect();
		return Math.max(
			0,
			Math.min(GRID_SLOT_COUNT - 1, Math.floor((event.clientY - rect.top) / ROW_HEIGHT)),
		);
	}

	function handleColumnMove(event: React.PointerEvent<HTMLDivElement>, facilityId: number) {
		const mode = dragMode.current;
		if (!mode) return;
		const column = columnAtPointer(event, event.currentTarget);
		// Read refs now: this updater can run after pointerup has already cleared them.
		const from = anchor.current;
		const offset = grabOffset.current;

		/** The furthest bookable column from `start` towards `target`. */
		function reach(start: number, target: number): number {
			const step = target >= start ? 1 : -1;
			let last = start;
			for (let index = start + step; (index - target) * step <= 0; index += step) {
				if (!canBook(facilityId, index)) break;
				last = index;
			}
			return last;
		}

		function nextSelection(current: Selection): Selection {
			if (mode === "move") {
				const length = current.end - current.start;
				const start = Math.max(0, Math.min(GRID_SLOT_COUNT - length, column - offset));
				for (let index = start; index < start + length; index++) {
					if (!canBook(facilityId, index)) return current;
				}
				return { facilityId, start, end: start + length };
			}
			if (current.facilityId !== facilityId) return current;

			if (mode === "create") {
				if (!from || from.facilityId !== facilityId) return current;
				const edge = reach(from.column, column);
				return {
					facilityId,
					start: Math.min(from.column, edge),
					end: Math.max(from.column, edge) + 1,
				};
			}

			const { start, end } = current;
			if (mode === "start") {
				return {
					facilityId,
					start: column < start ? reach(start, column) : Math.min(column, end - 1),
					end,
				};
			}
			return {
				facilityId,
				start,
				end: column >= end ? reach(end - 1, column) + 1 : Math.max(column + 1, start + 1),
			};
		}

		// Returning `current` lets React skip the render while the pointer stays in a cell.
		setSelection((current) => {
			if (!current) return current;
			const next = nextSelection(current);
			return next.facilityId === current.facilityId &&
				next.start === current.start &&
				next.end === current.end
				? current
				: next;
		});
	}

	function grabHandle(mode: DragMode) {
		return (event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "mouse" || !selection) return;
			event.preventDefault();
			event.stopPropagation();
			dragMode.current = mode;
			if (mode === "move") {
				const column = event.currentTarget.closest("[data-grid-column]");
				if (column) grabOffset.current = columnAtPointer(event, column) - selection.start;
			}
		};
	}

	const chosenCca =
		bookingCcas.find((cca) => cca.id === chosenCcaId) ?? (canRequest ? bookingCcas[0] : undefined);

	async function submitRequest() {
		if (!selection || !chosenCca) return;
		const { facilityId, start, end } = selection;
		setBusy(true);
		try {
			await requestVenue({
				facilityId,
				date: day,
				hours: GRID_HOURS.slice(start, end),
				ccaId: chosenCca.id,
			});
			toast.success(
				`Request sent · ${facilityName(facilityId)} · ${formatHourSpan(start, end)} · ${weekdayLabel(day)}`,
			);
			setSelection(null);
			await onChanged();
		} catch (error) {
			toast.error(errorMessage(error, "Failed to send request"));
		} finally {
			setBusy(false);
		}
	}

	async function cancelPicked() {
		if (!picked) return;
		setBusy(true);
		try {
			await withdrawBooking(picked);
			setPickedClaimId(null);
			setConfirming(false);
			await onChanged();
		} catch (error) {
			toast.error(errorMessage(error, "Failed to withdraw"));
		} finally {
			setBusy(false);
		}
	}

	const showAside = panelOpen || (userReady && !canRequest);
	const hint = !canRequest
		? ""
		: selection
			? "Drag the handles to resize, or drag the block to another time or venue · Esc to clear"
			: "Click a time, or drag down a column · Click your booking to manage it";
	const currentWeekIsFirst = weeks[0].dates.includes(today);

	return (
		<div className="flex flex-wrap items-start gap-5">
			<section
				className={cn(FACILITY_CARD_CLASS, "flex min-w-0 flex-[1_1_640px] flex-col gap-3.5 p-4")}
			>
				<div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
					<div className="flex items-center gap-1.5">
						<WeekArrow
							label="Previous week"
							enabled={weekIndex > 0}
							onClick={() => goToWeek(weekIndex - 1)}
						>
							‹
						</WeekArrow>
						<WeekArrow
							label="Next week"
							enabled={weekIndex < weeks.length - 1}
							onClick={() => goToWeek(weekIndex + 1)}
						>
							›
						</WeekArrow>
					</div>
					<div className="flex flex-wrap items-baseline gap-2">
						<span className="text-[17px] font-bold">
							{week.label}
							{week.dates.includes(today) ? " · this week" : ""}
						</span>
						<span className="text-[13px] text-muted-foreground">
							{formatWeekRange(week.start, week.end)}
						</span>
					</div>
					{weekIndex > 0 && (
						<button
							type="button"
							onClick={() => goToWeek(0)}
							className="h-[30px] cursor-pointer rounded-full border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent"
						>
							{currentWeekIsFirst ? "Back to this week" : `Back to ${weeks[0].label}`}
						</button>
					)}
					<div className="ml-auto flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							Up to {BOOKING_WEEKS_AHEAD} weeks ahead
						</span>
						<div className="flex gap-1">
							{weeks.map((option, index) => (
								<button
									key={option.start}
									type="button"
									aria-label={`${option.label} · ${formatWeekRange(option.start, option.end)}`}
									title={`${option.label} · ${formatWeekRange(option.start, option.end)}`}
									onClick={() => goToWeek(index)}
									className={cn(
										"h-1.5 cursor-pointer rounded-full transition-[width] duration-200",
										index === weekIndex ? "w-5 bg-primary" : "w-2 bg-border",
									)}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-7 overflow-hidden rounded-[10px] border">
					{week.dates.map((date) => {
						const selected = date === day;
						const chips = mySegments
							.filter((segment) => segment.date === date)
							.sort((a, b) => a.start - b.start);
						return (
							<button
								key={date}
								type="button"
								aria-pressed={selected}
								onClick={() => selectDay(date)}
								className={cn(
									"relative -ml-px flex min-w-0 cursor-pointer flex-col items-center gap-[3px] border-l px-1 pb-3 pt-2.5",
									selected ? "bg-fac-tint text-fac-title" : "bg-card text-foreground",
									date < today && "opacity-55",
								)}
							>
								<span className="text-[11px] font-bold tracking-[0.04em]">
									{date === today ? "TODAY" : weekdayLabel(date).toUpperCase()}
								</span>
								<span className="text-xl font-bold leading-none">{dayOfMonth(date)}</span>
								<span className="mt-[3px] flex min-h-9 w-full flex-col items-center justify-center gap-[3px]">
									{chips.map((segment) => (
										<span
											key={segment.claim_ids[0]}
											className={cn(
												"max-w-full truncate rounded-full border px-[7px] text-[10.5px] font-bold leading-4",
												MINE_CHIP_CLASS[segment.status],
											)}
										>
											{segment.cca_name}
										</span>
									))}
								</span>
								<span
									className={cn(
										"absolute inset-x-0 bottom-0 h-0.5",
										selected ? "bg-primary" : "bg-transparent",
									)}
								/>
							</button>
						);
					})}
				</div>

				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
					<LegendItem className="border bg-card" label="Open" />
					<LegendItem className="border bg-fac-closed" label="Not open" />
					<LegendItem className="border border-fac-booked-line bg-fac-booked" label="Booked" />
					<LegendItem className="bg-primary" label="Your CCA" />
					<LegendItem
						className="border-[1.5px] border-dashed border-fac-dash bg-fac-tint"
						label="Your pending"
					/>
					<LegendItem className="border border-fac-danger-line bg-fac-danger" label="Declined" />
					<span className="flex items-center gap-1.5">
						<span className="rounded-full bg-fac-warn px-1.5 py-px text-[10px] font-bold text-fac-warn-ink">
							1 request
						</span>
						Requested by others
					</span>
					<span className="ml-auto font-semibold text-foreground">{hint}</span>
				</div>

				<div className="overflow-x-auto rounded-[10px] border">
					<div className="min-w-[640px] select-none">
						<div className="flex border-b bg-background">
							<div className="w-[60px] flex-none" />
							{facilities.map((facility) => {
								const name = facility.sub_venue || facility.venue;
								return (
									<div
										key={facility.id}
										className="min-w-24 flex-[1_1_0] border-l px-1.5 py-[9px] text-center"
									>
										<div className="truncate text-[13px] font-bold">{name}</div>
										<div className="min-h-3.5 text-[11px] text-muted-foreground">
											{name.startsWith(facility.venue) ? "" : facility.venue}
										</div>
									</div>
								);
							})}
						</div>
						<div className="flex">
							<div className="w-[60px] flex-none">
								{GRID_HOURS.map((hour, column) => (
									<div
										key={hour}
										style={{ height: ROW_HEIGHT }}
										className="whitespace-nowrap pr-2 pt-[3px] text-right text-[11px] font-semibold leading-[1.1] text-muted-foreground"
									>
										<div>{formatClock(hour)}</div>
										{column === NEXT_DAY_COLUMN && (
											<div className="text-[9.5px] font-semibold text-fac-primary-hover">
												next day
											</div>
										)}
									</div>
								))}
							</div>
							{facilities.map((facility) => (
								<VenueColumn
									key={facility.id}
									facility={facility}
									day={day}
									today={today}
									currentHour={currentHour}
									segments={groupClaimSegments(
										weekClaims.filter(
											(claim) =>
												claim.facility_id === facility.id &&
												claim.date === day &&
												(claim.status === "approved" || myCcaIds.has(claim.cca_id)),
										),
									).filter((segment) => !(segment.status === "rejected" && givenAway(segment)))}
									myCcaIds={myCcaIds}
									openCells={openCells}
									selection={selection?.facilityId === facility.id ? selection : null}
									pickedClaimIds={picked?.claim_ids ?? null}
									isBooked={isBooked}
									hasMine={(column) =>
										claimsAt(facility.id, day, column).some((claim) => myCcaIds.has(claim.cca_id))
									}
									othersPending={othersPending}
									canBook={canBook}
									onCellPointerDown={(column, event) => {
										pressedWithMouse.current = event.pointerType === "mouse";
										if (event.pointerType !== "mouse" || event.button !== 0) return;
										dragMode.current = "create";
										setCreating(true);
										anchor.current = { facilityId: facility.id, column };
										beginSelection(facility.id, column);
									}}
									onCellClick={(column, event) => {
										// A mouse press already started the selection. Keyboard activation
										// (detail 0) and touch taps select here instead.
										if (event.detail > 0 && pressedWithMouse.current) return;
										beginSelection(facility.id, column);
									}}
									onColumnMove={(event) => handleColumnMove(event, facility.id)}
									onPick={(segment) => {
										setPickedClaimId(segment.claim_ids[0]);
										setConfirming(false);
										setSelection(null);
									}}
									grabHandle={grabHandle}
									competingLabel={(segment) =>
										countCcas(segment.start, segment.end, (column) =>
											othersPending(segment.facility_id, segment.date, column, segment.cca_id),
										)
									}
								/>
							))}
						</div>
					</div>
				</div>
			</section>

			{showAside && (
				<aside
					ref={asideRef}
					className="flex min-w-[280px] max-w-[380px] flex-[1_1_300px] animate-[fade-in_0.2s_ease-out] flex-col gap-4"
				>
					{picked && (
						<BookingPanel
							segment={picked}
							venue={facilityName(picked.facility_id)}
							today={today}
							currentHour={currentHour}
							competing={
								picked.status === "approved"
									? 0
									: countCcas(picked.start, picked.end, (column) =>
											othersPending(picked.facility_id, picked.date, column, picked.cca_id),
										)
							}
							confirming={confirming}
							busy={busy}
							onAsk={() => setConfirming(true)}
							onBack={() => setConfirming(false)}
							onClose={() => {
								setPickedClaimId(null);
								setConfirming(false);
							}}
							onConfirm={cancelPicked}
						/>
					)}
					{selection && !creating && chosenCca && (
						<NewRequestPanel
							selection={selection}
							day={day}
							today={today}
							venue={facilityName(selection.facilityId)}
							bookingCcas={bookingCcas}
							chosenCca={chosenCca}
							busy={busy}
							canBook={canBook}
							othersPending={othersPending}
							onChange={setSelection}
							onChooseCca={setChosenCcaId}
							onSubmit={submitRequest}
							onClear={() => setSelection(null)}
						/>
					)}
					{userReady && !canRequest && isJcrc && (
						<div className={cn(FACILITY_CARD_CLASS, "flex flex-col gap-2.5 p-4")}>
							<span className="text-[15px] font-bold">Reviewing as JCRC</span>
							<span className="text-[13px] leading-[1.45] text-muted-foreground">
								This grid shows every confirmed booking and how many requests are waiting on each
								hour.
							</span>
							<Button asChild className="self-start rounded-[10px] font-bold">
								<Link href="/dashboard/facilities/admin">Review requests</Link>
							</Button>
						</div>
					)}
					{userReady && !canRequest && !isJcrc && (
						<div className={cn(FACILITY_CARD_CLASS, "flex flex-col gap-1.5 p-4")}>
							<span className="text-[15px] font-bold">Need a venue?</span>
							<span className="text-[13px] leading-[1.45] text-muted-foreground">
								Only committee chairs and vice-chairs can request slots. Ask your committee chair if
								you need one.
							</span>
						</div>
					)}
				</aside>
			)}
		</div>
	);
}

function WeekArrow({
	label,
	enabled,
	onClick,
	children,
}: {
	label: string;
	enabled: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={!enabled}
			onClick={onClick}
			className="size-[34px] cursor-pointer rounded-[10px] border bg-card text-lg leading-none hover:bg-accent disabled:cursor-default disabled:opacity-35 disabled:hover:bg-card"
		>
			{children}
		</button>
	);
}

function VenueColumn({
	facility,
	day,
	today,
	currentHour,
	segments,
	myCcaIds,
	openCells,
	selection,
	pickedClaimIds,
	isBooked,
	hasMine,
	othersPending,
	canBook,
	onCellPointerDown,
	onCellClick,
	onColumnMove,
	onPick,
	grabHandle,
	competingLabel,
}: {
	facility: Facility;
	day: string;
	today: string;
	currentHour: number;
	segments: ClaimSegment[];
	myCcaIds: Set<number>;
	openCells: Set<string>;
	selection: Selection | null;
	pickedClaimIds: number[] | null;
	isBooked: (facilityId: number, date: string, column: number) => boolean;
	hasMine: (column: number) => boolean;
	othersPending: (facilityId: number, date: string, column: number) => GridClaim[];
	canBook: (facilityId: number, column: number) => boolean;
	onCellPointerDown: (column: number, event: React.PointerEvent) => void;
	onCellClick: (column: number, event: React.MouseEvent) => void;
	onColumnMove: (event: React.PointerEvent<HTMLDivElement>) => void;
	onPick: (segment: ClaimSegment) => void;
	grabHandle: (mode: DragMode) => (event: React.PointerEvent<HTMLDivElement>) => void;
	competingLabel: (segment: ClaimSegment) => number;
}) {
	const name = facilityLabel(facility);
	const overlapCount = useMemo(() => {
		if (!selection) return 0;
		return countCcas(selection.start, selection.end, (column) =>
			othersPending(facility.id, day, column),
		);
	}, [selection, othersPending, facility.id, day]);

	return (
		<div
			data-grid-column
			onPointerMove={onColumnMove}
			className="relative min-w-24 flex-[1_1_0] border-l"
		>
			{GRID_HOURS.map((hour, column) => {
				const open = openCells.has(cellKey(facility.id, day, column));
				const past = isSlotPast(day, column, today, currentHour);
				const bookable = canBook(facility.id, column);
				const requests =
					open && !past && !isBooked(facility.id, day, column) && !hasMine(column)
						? new Set(othersPending(facility.id, day, column).map((claim) => claim.cca_id)).size
						: 0;
				const span = formatHourSpan(column, column + 1);

				return (
					<button
						key={hour}
						type="button"
						disabled={!bookable}
						aria-label={
							bookable
								? `Request ${name}, ${span}`
								: `${name}, ${span}, ${open ? "unavailable" : "not open"}`
						}
						onPointerDown={(event) => onCellPointerDown(column, event)}
						onClick={(event) => onCellClick(column, event)}
						style={{ height: ROW_HEIGHT }}
						className={cn(
							"flex w-full items-center justify-end border-t px-1.5",
							column === NEXT_DAY_COLUMN ? "border-t-fac-soft-line" : "border-t-fac-rule",
							!open
								? "bg-fac-closed"
								: past
									? "bg-fac-past"
									: requests > 0
										? "bg-fac-contested"
										: "bg-card",
							bookable ? "cursor-pointer hover:bg-fac-tint" : "cursor-default",
						)}
					>
						{requests > 0 && (
							<span className="whitespace-nowrap rounded-full border border-fac-warn-line bg-fac-warn px-1.5 text-[10px] font-bold text-fac-warn-ink">
								{requests === 1 ? "1 request" : `${requests} requests`}
							</span>
						)}
					</button>
				);
			})}

			{segments.map((segment) => {
				const mine = myCcaIds.has(segment.cca_id);
				const hours = segment.end - segment.start;
				const competing = segment.status === "pending" ? competingLabel(segment) : 0;
				const status =
					segment.status === "approved"
						? mine
							? "Confirmed"
							: "Booked"
						: segment.status === "rejected"
							? "Declined"
							: competing
								? `Pending · ${competing} competing`
								: "Pending";
				const isPicked = pickedClaimIds?.includes(segment.claim_ids[0]) ?? false;
				const locked = segment.status === "approved" && !mine;
				const content = (
					<>
						<span className="flex min-w-0 items-center gap-[5px]">
							{locked && <Lock className="size-3 flex-none opacity-70" aria-hidden="true" />}
							<span className="truncate text-xs font-bold">
								{hours === 1 ? `${segment.cca_name} · ${status}` : segment.cca_name}
							</span>
						</span>
						{hours > 1 && (
							<span className="truncate text-[11px] font-medium opacity-90">
								{formatHourSpan(segment.start, segment.end)} · {status}
							</span>
						)}
					</>
				);
				const blockClass = cn(
					"absolute inset-x-1 z-[1] flex flex-col justify-center gap-px overflow-hidden rounded-[8px] px-2 py-1 text-left",
					segment.status === "approved" && mine && "border border-primary bg-primary text-white",
					segment.status === "approved" &&
						!mine &&
						"border border-fac-booked-line bg-fac-booked text-fac-booked-ink",
					segment.status === "rejected" &&
						"border border-fac-danger-line bg-fac-danger text-fac-danger-ink",
					segment.status === "pending" &&
						"border-[1.5px] border-dashed border-fac-dash bg-fac-tint text-fac-ink",
					isPicked && "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--primary)]",
				);
				const position = {
					top: segment.start * ROW_HEIGHT + 2,
					height: hours * ROW_HEIGHT - 4,
				};
				return mine ? (
					<button
						key={segment.claim_ids[0]}
						type="button"
						title="Click to manage"
						onClick={() => onPick(segment)}
						style={position}
						className={cn(blockClass, "cursor-pointer")}
					>
						{content}
					</button>
				) : (
					<div
						key={segment.claim_ids[0]}
						style={position}
						className={cn(blockClass, "pointer-events-none")}
					>
						{content}
					</div>
				);
			})}

			{selection && (
				<div
					onPointerDown={grabHandle("move")}
					style={{
						top: selection.start * ROW_HEIGHT + 1,
						height: (selection.end - selection.start) * ROW_HEIGHT - 1,
					}}
					className="absolute inset-x-[3px] z-[2] flex cursor-grab flex-col items-center justify-center rounded-[9px] border-2 border-primary bg-fac-selection px-2 py-0.5 text-fac-ink shadow-[0_6px_16px_color-mix(in_oklch,var(--primary)_28%,transparent)] active:cursor-grabbing"
				>
					<div
						onPointerDown={grabHandle("start")}
						title="Drag to change start"
						className="absolute inset-x-0 top-0 flex h-3 cursor-ns-resize items-start justify-center pt-[3px]"
					>
						<span className="h-[5px] w-7 rounded-full bg-primary" />
					</div>
					<span className="whitespace-nowrap text-xs font-bold">
						{formatHourSpan(selection.start, selection.end)}
					</span>
					{/* One row only has room for the time between the two handles. */}
					{selection.end - selection.start > 1 && (
						<span className="text-[11px] font-bold">
							{formatDuration(selection.end - selection.start)}
						</span>
					)}
					{overlapCount > 0 && selection.end - selection.start > 1 && (
						<span className="text-[10.5px] font-bold text-fac-warn-ink">
							Overlaps {overlapCount} request{overlapCount > 1 ? "s" : ""}
						</span>
					)}
					<div
						onPointerDown={grabHandle("end")}
						title="Drag to change end"
						className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-end justify-center pb-[3px]"
					>
						<span className="h-[5px] w-7 rounded-full bg-primary" />
					</div>
				</div>
			)}
		</div>
	);
}

function TimeStepper({
	label,
	value,
	earlier,
	later,
}: {
	label: "Start" | "End";
	value: string;
	earlier: { enabled: boolean; run: () => void };
	later: { enabled: boolean; run: () => void };
}) {
	const stepClass =
		"h-full w-8 cursor-pointer text-base disabled:cursor-default disabled:opacity-30";
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs font-semibold text-muted-foreground">{label}</span>
			<div className="flex h-[38px] items-center overflow-hidden rounded-[10px] border">
				<button
					type="button"
					aria-label={`${label} earlier`}
					disabled={!earlier.enabled}
					onClick={earlier.run}
					className={stepClass}
				>
					‹
				</button>
				<span className="flex-1 text-center text-sm font-bold">{value}</span>
				<button
					type="button"
					aria-label={`${label} later`}
					disabled={!later.enabled}
					onClick={later.run}
					className={stepClass}
				>
					›
				</button>
			</div>
		</div>
	);
}

function NewRequestPanel({
	selection,
	day,
	today,
	venue,
	bookingCcas,
	chosenCca,
	busy,
	canBook,
	othersPending,
	onChange,
	onChooseCca,
	onSubmit,
	onClear,
}: {
	selection: Selection;
	day: string;
	today: string;
	venue: string;
	bookingCcas: BookingCca[];
	chosenCca: BookingCca;
	busy: boolean;
	canBook: (facilityId: number, column: number) => boolean;
	othersPending: (
		facilityId: number,
		date: string,
		column: number,
		excludeCcaId?: number,
	) => GridClaim[];
	onChange: (selection: Selection) => void;
	onChooseCca: (ccaId: number) => void;
	onSubmit: () => void;
	onClear: () => void;
}) {
	const { facilityId, start, end } = selection;

	const competitors = new Map<string, number[]>();
	for (let column = start; column < end; column++) {
		for (const claim of othersPending(facilityId, day, column, chosenCca.id)) {
			competitors.set(claim.cca_name, [...(competitors.get(claim.cca_name) ?? []), column]);
		}
	}
	const competitionText = [...competitors.entries()]
		.map(
			([cca, columns]) =>
				`${cca} also asked for ${formatHourSpan(Math.min(...columns), Math.max(...columns) + 1)}`,
		)
		.join(". ");

	return (
		<div className="flex flex-col gap-3.5 rounded-[12px] border-2 border-fac-soft-line bg-card p-[18px] shadow-sm">
			<div className="flex flex-col gap-0.5">
				<span className="text-xs font-bold text-fac-title">New request</span>
				<span className="text-lg font-bold">{venue}</span>
				<span className="text-[13px] text-muted-foreground">
					{formatDayLabel(day)}
					{day === today ? " · Today" : ""}
				</span>
			</div>
			<div className="grid grid-cols-2 gap-2.5">
				<TimeStepper
					label="Start"
					value={formatClock(GRID_HOURS[start])}
					earlier={{
						enabled: canBook(facilityId, start - 1),
						run: () => onChange({ ...selection, start: start - 1 }),
					}}
					later={{
						enabled: start + 1 < end,
						run: () => onChange({ ...selection, start: start + 1 }),
					}}
				/>
				<TimeStepper
					label="End"
					value={formatClock((GRID_HOURS[end - 1] + 1) % 24)}
					earlier={{
						enabled: end - 1 > start,
						run: () => onChange({ ...selection, end: end - 1 }),
					}}
					later={{
						enabled: canBook(facilityId, end),
						run: () => onChange({ ...selection, end: end + 1 }),
					}}
				/>
			</div>
			<span className="-mt-1.5 text-[13px] text-muted-foreground">
				{formatDuration(end - start)}
			</span>
			{bookingCcas.length > 1 && (
				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-semibold text-muted-foreground">Booking for</span>
					<div className="flex flex-wrap gap-1.5">
						{bookingCcas.map((cca) => (
							<button
								key={cca.id}
								type="button"
								aria-pressed={cca.id === chosenCca.id}
								onClick={() => onChooseCca(cca.id)}
								className={cn(
									"h-8 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold",
									cca.id === chosenCca.id
										? "border-primary bg-primary text-white"
										: "bg-card text-foreground",
								)}
							>
								{cca.name}
							</button>
						))}
					</div>
				</div>
			)}
			{competitionText && (
				<div className="rounded-[10px] border border-fac-warn-line bg-fac-warn-soft px-3 py-2.5 text-[13px] leading-[1.45] text-fac-warn-ink">
					{competitionText}. You can still send yours and JCRC will pick one.
				</div>
			)}
			<div className="flex gap-2">
				<Button
					onClick={onSubmit}
					isLoading={busy}
					loadingText="Sending…"
					className="h-10 flex-1 rounded-[10px] font-bold hover:bg-fac-primary-hover"
				>
					Send request
				</Button>
				<Button
					variant="outline"
					onClick={onClear}
					disabled={busy}
					className="h-10 rounded-[10px] bg-card px-3.5"
				>
					Clear
				</Button>
			</div>
			<span className="text-xs leading-[1.45] text-muted-foreground">
				JCRC approves every request. Track its status under My bookings.
			</span>
		</div>
	);
}

function BookingPanel({
	segment,
	venue,
	today,
	currentHour,
	competing,
	confirming,
	busy,
	onAsk,
	onBack,
	onClose,
	onConfirm,
}: {
	segment: ClaimSegment;
	venue: string;
	today: string;
	currentHour: number;
	competing: number;
	confirming: boolean;
	busy: boolean;
	onAsk: () => void;
	onBack: () => void;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const approved = segment.status === "approved";
	const rejected = segment.status === "rejected";
	const past = isSlotPast(segment.date, segment.end - 1, today, currentHour);
	const style = CLAIM_STATUS_STYLE[segment.status];
	const note = rejected
		? "JCRC declined this request"
		: competing
			? `${competing} other CCA${competing > 1 ? "s" : ""} also asked for this time`
			: "";

	return (
		<div className="flex flex-col gap-3.5 rounded-[12px] border-2 border-fac-soft-line bg-card p-[18px] shadow-sm">
			<div className="flex items-start gap-2">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="text-xs font-bold text-fac-title">
						{approved ? "Your booking" : "Your request"}
					</span>
					<span className="text-lg font-bold">{venue}</span>
					<span className="text-[13px] text-muted-foreground">
						{formatDayLabel(segment.date)}
						{segment.date === today ? " · Today" : ""}
					</span>
				</div>
				<button
					type="button"
					aria-label="Close"
					onClick={onClose}
					className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			</div>
			<div className="flex flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", style.className)}>
						{style.label}
					</span>
					<span className="text-sm font-semibold">
						{formatHourSpan(segment.start, segment.end)} ·{" "}
						{formatDuration(segment.end - segment.start)}
					</span>
				</div>
				<span className="text-[13px] text-muted-foreground">For {segment.cca_name}</span>
				{note && <span className="text-[12.5px] text-fac-warn-ink">{note}</span>}
			</div>
			{!past && !rejected && !confirming && (
				<button
					type="button"
					onClick={onAsk}
					className="h-[38px] cursor-pointer rounded-[10px] border bg-card text-sm font-bold text-destructive hover:bg-fac-danger"
				>
					{approved ? "Cancel booking" : "Withdraw request"}
				</button>
			)}
			{!past && !rejected && confirming && (
				<WithdrawConfirm
					approved={approved}
					prompt={
						approved
							? `Cancel ${segment.cca_name}'s booking? The slot reopens for other CCAs.`
							: "Withdraw this request? JCRC won't see it any more."
					}
					busy={busy}
					onConfirm={onConfirm}
					onBack={onBack}
					className="rounded-[10px] border border-fac-danger-line bg-fac-danger p-3"
				/>
			)}
			{past && (
				<span className="text-[12.5px] text-muted-foreground">This slot has already passed.</span>
			)}
		</div>
	);
}
