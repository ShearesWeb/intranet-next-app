"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FACILITY_CARD_CLASS, VenueSwitch } from "@/components/facilities/facility-ui";
import {
	GRID_HOURS,
	NEXT_DAY_COLUMN,
	columnOfHour,
	facilityLabel,
	formatDayLabel,
	formatHourSpan,
	formatShortHour,
	groupClaimSegments,
} from "@/lib/facilities/booking-grid";
import { errorMessage, saveWeeklyHours, setVenueVisible } from "@/lib/facilities/facility-client";
import {
	ApprovalsPayload,
	ReviewClaim,
	confirmedClaims,
	pendingClaims,
} from "@/lib/facilities/request-view";
import {
	WEEK_ROW_LABELS,
	WeekGrid,
	cellsFromWeekGrid,
	emptyWeekGrid,
	isFacilityHidden,
	summarizeRow,
	summarizeWeek,
	weekGridFromSchedules,
	weekdayToRow,
} from "@/lib/facilities/weekly-availability";
import { getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { cn } from "@/lib/utils";
import { Facility, FacilitySchedule, weekdayOf } from "@/types/facilities";

interface FacilityAvailabilityProps {
	facilities: Facility[];
	schedules: FacilitySchedule[];
	approvals: ApprovalsPayload;
	onChanged: () => Promise<unknown>;
}

const HATCH = "repeating-linear-gradient(135deg, oklch(0.3 0 0 / 0.22) 0 3px, transparent 3px 7px)";
const ACTION_BUTTON_CLASS =
	"h-[30px] cursor-pointer rounded-[10px] border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent";

function rowOfDate(date: string): number {
	return weekdayToRow(weekdayOf(date));
}

function cellStyle(
	open: boolean,
	saved: boolean,
	booked: boolean,
	previous: boolean,
	next: boolean,
) {
	const base = open
		? saved
			? { color: "var(--primary)", border: "var(--primary)" }
			: { color: "var(--fac-soft-line)", border: "var(--primary)" }
		: saved
			? { color: "var(--fac-danger)", border: "#f87171" }
			: { color: "var(--card)", border: "var(--border)" };
	const left = previous ? 2 : 7;
	const right = next ? 2 : 7;
	return {
		background: booked ? `${HATCH}, ${base.color}` : base.color,
		borderColor: base.border,
		borderRadius: open ? `${left}px ${right}px ${right}px ${left}px` : "4px",
	};
}

/** JCRC paints the weekly hours each venue is open for CCA requests. */
export function FacilityAvailability({
	facilities,
	schedules,
	approvals,
	onChanged,
}: FacilityAvailabilityProps) {
	const today = getSingaporeDateKey();
	const [selectedId, setSelectedId] = useState<number | null>(facilities[0]?.id ?? null);
	const [draft, setDraft] = useState<WeekGrid | null>(null);
	const [saving, setSaving] = useState(false);
	const [togglingId, setTogglingId] = useState<number | null>(null);
	const paintValue = useRef<boolean | null>(null);
	const pressedWithMouse = useRef(false);

	useEffect(() => {
		function stopPainting() {
			paintValue.current = null;
		}
		window.addEventListener("pointerup", stopPainting);
		return () => window.removeEventListener("pointerup", stopPainting);
	}, []);

	const schedulesByFacility = useMemo(() => {
		const grouped = new Map<number, FacilitySchedule[]>();
		for (const schedule of schedules) {
			grouped.set(schedule.facility_id, [...(grouped.get(schedule.facility_id) ?? []), schedule]);
		}
		return grouped;
	}, [schedules]);

	const selected = facilities.find((facility) => facility.id === selectedId) ?? facilities[0];
	const selectedSchedules = useMemo(
		() => (selected ? (schedulesByFacility.get(selected.id) ?? []) : []),
		[schedulesByFacility, selected],
	);
	const saved = useMemo(
		() => weekGridFromSchedules(selectedSchedules, today),
		[selectedSchedules, today],
	);
	const grid = draft ?? saved;
	const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

	let added = 0;
	let removed = 0;
	grid.forEach((row, rowIndex) =>
		row.forEach((open, column) => {
			if (open && !saved[rowIndex][column]) added++;
			if (!open && saved[rowIndex][column]) removed++;
		}),
	);

	const bookings = useMemo(() => {
		if (!selected) return [];
		return [...pendingClaims(approvals), ...confirmedClaims(approvals)].filter(
			(claim) => claim.facility_id === selected.id,
		);
	}, [approvals, selected]);

	// Bookings sitting in hours this draft closes: saving is what cancels them.
	const affected = useMemo(
		() =>
			groupClaimSegments(
				bookings.filter((claim: ReviewClaim) => {
					const row = rowOfDate(claim.date);
					const column = columnOfHour(claim.hour);
					return column >= 0 && saved[row][column] && !grid[row][column];
				}),
			).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start),
		[bookings, saved, grid],
	);

	function edit(change: (next: WeekGrid) => void) {
		setDraft((current) => {
			const next = (current ?? saved).map((row) => [...row]);
			change(next);
			return next;
		});
	}

	function pickVenue(facility: Facility) {
		if (facility.id === selected?.id) return;
		if (dirty && selected) {
			toast.error(`Save or discard changes to ${facilityLabel(selected)} first`);
			return;
		}
		setDraft(null);
		setSelectedId(facility.id);
	}

	async function toggleVisibility(facility: Facility) {
		const rows = schedulesByFacility.get(facility.id) ?? [];
		if (rows.length === 0) {
			toast.error(`Paint and save hours for ${facilityLabel(facility)} first`);
			return;
		}
		const nextVisible = isFacilityHidden(rows, today);
		setTogglingId(facility.id);
		try {
			await setVenueVisible(facility.id, nextVisible);
			toast.success(
				`${facilityLabel(facility)} ${nextVisible ? "is open for requests" : "is hidden from Book"}`,
			);
			await onChanged();
		} catch (error) {
			toast.error(errorMessage(error, "Failed to update availability"));
		} finally {
			setTogglingId(null);
		}
	}

	async function save() {
		if (!selected || !draft) return;
		setSaving(true);
		try {
			await saveWeeklyHours(
				selected.id,
				cellsFromWeekGrid(draft),
				affected.flatMap((segment) => segment.claim_ids),
			);
			const cancelled = affected.length;
			toast.success(
				`Saved · ${facilityLabel(selected)} hours updated${
					cancelled ? ` · ${cancelled} booking${cancelled > 1 ? "s" : ""} cancelled` : ""
				}`,
			);
			await onChanged();
			setDraft(null);
		} catch (error) {
			toast.error(errorMessage(error, "Failed to update availability"));
			await onChanged();
		} finally {
			setSaving(false);
		}
	}

	if (!selected) return null;

	const hidden = isFacilityHidden(selectedSchedules, today);
	const selectedHasHours = selectedSchedules.length > 0;
	const switchedOn = selectedHasHours && !hidden;

	return (
		<div className="flex flex-wrap items-start gap-5">
			<div
				className={cn(FACILITY_CARD_CLASS, "flex max-w-80 flex-[1_1_260px] flex-col gap-0.5 p-2")}
			>
				<span className="px-2.5 pb-1 pt-2 text-xs font-bold text-muted-foreground">
					Sheares venues
				</span>
				{facilities.map((facility) => {
					const rows = schedulesByFacility.get(facility.id) ?? [];
					const venueHidden = isFacilityHidden(rows, today);
					const active = facility.id === selected.id;
					return (
						<div
							key={facility.id}
							onClick={() => pickVenue(facility)}
							className={cn(
								"flex cursor-pointer items-start gap-2.5 rounded-[10px] p-2.5",
								active ? "bg-accent" : "hover:bg-fac-tint",
							)}
						>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<button
									type="button"
									aria-pressed={active}
									onClick={(event) => {
										event.stopPropagation();
										pickVenue(facility);
									}}
									className="cursor-pointer text-left text-sm font-bold"
								>
									{facilityLabel(facility)}
								</button>
								<span className="text-xs leading-[1.4] text-muted-foreground">
									{venueHidden
										? "Hidden from Book"
										: summarizeWeek(weekGridFromSchedules(rows, today))}
								</span>
							</div>
							<VenueSwitch
								size="sm"
								checked={rows.length > 0 && !venueHidden}
								label={`Open ${facilityLabel(facility)} for booking`}
								disabled={togglingId === facility.id}
								onToggle={() => void toggleVisibility(facility)}
							/>
						</div>
					);
				})}
			</div>

			<section
				className={cn(
					FACILITY_CARD_CLASS,
					"flex min-w-0 flex-[1_1_600px] flex-col overflow-hidden",
				)}
			>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b px-5 py-4">
					<div className="flex flex-col gap-0.5">
						<span className="text-lg font-bold">{facilityLabel(selected)}</span>
						<span className="text-[12.5px] text-muted-foreground">
							Hours committees can request, repeating every week
						</span>
					</div>
					<div className="ml-auto flex items-center gap-2.5">
						<span
							className={cn(
								"text-[13px] font-semibold",
								switchedOn ? "text-green-600" : "text-muted-foreground",
							)}
						>
							{switchedOn ? "Open for requests" : "Hidden from Book"}
						</span>
						<VenueSwitch
							checked={switchedOn}
							label={`Open ${facilityLabel(selected)} for booking`}
							disabled={togglingId === selected.id}
							onToggle={() => void toggleVisibility(selected)}
						/>
					</div>
				</div>

				<div className="flex flex-col gap-4 px-5 py-4">
					<div className="flex flex-wrap items-center gap-2">
						<span className="mr-1 text-[12.5px] text-muted-foreground">
							Drag across cells to paint hours. Click a day to fill or clear it.
						</span>
						<div className="ml-auto flex flex-wrap gap-1.5">
							<button
								type="button"
								className={ACTION_BUTTON_CLASS}
								onClick={() =>
									edit((next) => {
										for (let row = 1; row < 5; row++) next[row] = [...next[0]];
									})
								}
							>
								Copy Mon to weekdays
							</button>
							<button
								type="button"
								className={cn(ACTION_BUTTON_CLASS, "text-destructive hover:bg-fac-danger")}
								onClick={() => setDraft(emptyWeekGrid())}
							>
								Clear week
							</button>
						</div>
					</div>

					<div className="overflow-x-auto">
						<div className="flex min-w-[700px] select-none flex-col gap-1">
							<div className="flex items-end">
								<div className="w-[68px] flex-none" />
								<div className="flex flex-1 gap-0.5">
									{GRID_HOURS.map((hour, column) => (
										<span
											key={hour}
											className={cn(
												"min-w-6 flex-1 text-center text-[10.5px] font-semibold",
												column >= NEXT_DAY_COLUMN
													? "text-fac-primary-hover"
													: "text-muted-foreground",
											)}
										>
											{formatShortHour(hour)}
										</span>
									))}
								</div>
								<div className="w-[150px] flex-none" />
							</div>
							{WEEK_ROW_LABELS.map((label, rowIndex) => {
								const summary = summarizeRow(grid[rowIndex]);
								return (
									<div key={label} className="flex items-center">
										<button
											type="button"
											onClick={() =>
												edit((next) => {
													const any = next[rowIndex].some(Boolean);
													next[rowIndex] = next[rowIndex].map(() => !any);
												})
											}
											className="w-[68px] flex-none cursor-pointer text-left text-[13px] font-bold hover:text-fac-primary-hover"
										>
											{label}
										</button>
										<div className="flex flex-1 gap-0.5">
											{GRID_HOURS.map((hour, column) => {
												const open = grid[rowIndex][column];
												const wasOpen = saved[rowIndex][column];
												const booking = bookings.find(
													(claim) =>
														claim.status === "approved" &&
														rowOfDate(claim.date) === rowIndex &&
														columnOfHour(claim.hour) === column,
												);
												const span = formatHourSpan(column, column + 1);
												return (
													<button
														key={hour}
														type="button"
														aria-pressed={open}
														aria-label={`${label} ${span}`}
														title={`${label} ${span}${booking ? ` · Booked by ${booking.cca_name}` : ""}`}
														onPointerDown={(event) => {
															pressedWithMouse.current = event.pointerType === "mouse";
															if (event.pointerType !== "mouse" || event.button !== 0) return;
															paintValue.current = !open;
															edit((next) => {
																next[rowIndex][column] = !open;
															});
														}}
														onPointerEnter={() => {
															const value = paintValue.current;
															if (value === null) return;
															edit((next) => {
																next[rowIndex][column] = value;
															});
														}}
														onClick={(event) => {
															// A mouse press already painted this cell. Keyboard activation
															// (detail 0) and touch taps toggle here instead.
															if (event.detail > 0 && pressedWithMouse.current) return;
															edit((next) => {
																next[rowIndex][column] = !next[rowIndex][column];
															});
														}}
														style={cellStyle(
															open,
															wasOpen,
															Boolean(booking),
															column > 0 && grid[rowIndex][column - 1],
															column < GRID_HOURS.length - 1 && grid[rowIndex][column + 1],
														)}
														className="h-[30px] min-w-6 flex-1 cursor-pointer border"
													/>
												);
											})}
										</div>
										<span
											className={cn(
												"w-[150px] flex-none truncate pl-3 text-xs font-semibold",
												summary ? "text-foreground" : "text-muted-foreground",
											)}
										>
											{summary || "Closed"}
										</span>
									</div>
								);
							})}
						</div>
					</div>

					<div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
						<LegendItem style={{ background: "var(--primary)" }} label="Open" />
						<LegendItem
							style={{ background: "var(--fac-soft-line)", border: "1px solid var(--primary)" }}
							label="Adding"
						/>
						<LegendItem
							style={{ background: "var(--fac-danger)", border: "1px solid #f87171" }}
							label="Removing"
						/>
						<LegendItem
							style={{ background: `${HATCH}, var(--primary)` }}
							label="Booked by a CCA"
						/>
					</div>
				</div>

				{dirty ? (
					<div className="flex flex-col gap-2.5 border-t bg-fac-tint px-5 py-3.5">
						{affected.length > 0 && (
							<div className="flex flex-col gap-1 rounded-[10px] border border-fac-danger-line bg-fac-danger px-3 py-2.5 text-[13px] text-fac-danger-ink">
								<span className="font-bold">
									Saving will cancel {affected.length} booking{affected.length > 1 ? "s" : ""} in
									hours you&apos;re closing:
								</span>
								{affected.map((segment) => (
									<span key={segment.claim_ids[0]}>
										{segment.cca_name} · {formatDayLabel(segment.date)} ·{" "}
										{formatHourSpan(segment.start, segment.end)} (
										{segment.status === "approved" ? "confirmed" : "pending"})
									</span>
								))}
							</div>
						)}
						<div className="flex flex-wrap items-center gap-2.5">
							<span className="text-[13.5px] font-bold">Unsaved changes</span>
							<span className="text-[13px] text-muted-foreground">
								{[added ? `+${added} h` : "", removed ? `−${removed} h` : ""]
									.filter(Boolean)
									.join(" · ")}{" "}
								each week
							</span>
							<div className="ml-auto flex gap-2">
								<Button
									variant="outline"
									disabled={saving}
									onClick={() => setDraft(null)}
									className="rounded-[10px] bg-card px-3.5"
								>
									Discard
								</Button>
								<Button
									isLoading={saving}
									onClick={() => void save()}
									variant={affected.length ? "destructive" : "default"}
									className={cn(
										"rounded-[10px] font-bold",
										!affected.length && "hover:bg-fac-primary-hover",
									)}
								>
									{affected.length ? `Save and cancel ${affected.length}` : "Save changes"}
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="border-t px-5 py-3 text-[12.5px] text-muted-foreground">
						Saved. These hours repeat every week until you change them.
					</div>
				)}
			</section>
		</div>
	);
}

function LegendItem({ style, label }: { style: React.CSSProperties; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="size-3.5 rounded-[4px]" style={style} />
			{label}
		</span>
	);
}
