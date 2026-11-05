"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	CLAIM_STATUS_STYLE,
	FACILITY_CARD_CLASS,
	FacilityEmpty,
} from "@/components/facilities/facility-ui";
import { type MyClaim } from "@/hooks/use-my-facility-claims";
import {
	ClaimSegment,
	columnOfHour,
	dayOfMonth,
	facilityLabel,
	formatDayLabel,
	formatHourSpan,
	groupClaimSegments,
	isSlotPast,
	weekdayLabel,
} from "@/lib/facilities/booking-grid";
import { errorMessage, withdrawClaims } from "@/lib/facilities/facility-client";
import { getSingaporeDateKey, getSingaporeHour, getMondayOf } from "@/lib/nus-academic-calendar";
import { cn } from "@/lib/utils";
import { FacilitySlot } from "@/types/facilities";

type StatusFilter = "all" | "approved" | "pending" | "rejected";

const STATS: { key: Exclude<StatusFilter, "all">; label: string; dot: string }[] = [
	{ key: "approved", label: "Upcoming", dot: "bg-emerald-500" },
	{ key: "pending", label: "Pending", dot: "bg-amber-500" },
	{ key: "rejected", label: "Declined", dot: "bg-red-600" },
];

interface MyBookingsProps {
	claims: MyClaim[];
	slots: FacilitySlot[];
	chairCcas: { id: number; name: string }[];
	loading: boolean;
	/** Dates the calendar can show; "View on grid" is hidden for anything else. */
	gridDates: Set<string>;
	onViewOnGrid: (date: string) => void;
	onChanged: () => Promise<unknown>;
}

/** Every request a chair has sent, merged into time ranges, with a status overview. */
export function MyBookings({
	claims,
	slots,
	chairCcas,
	loading,
	gridDates,
	onViewOnGrid,
	onChanged,
}: MyBookingsProps) {
	const [ccaFilter, setCcaFilter] = useState<number | null>(null);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [openKey, setOpenKey] = useState<number | null>(null);
	const [confirmKey, setConfirmKey] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);

	const today = getSingaporeDateKey();
	const currentHour = getSingaporeHour();
	const myCcaIds = useMemo(() => new Set(chairCcas.map((cca) => cca.id)), [chairCcas]);

	// What the rest of the hall is doing on each hour, for the notes on each row.
	const { bookedCells, competitorsByCell } = useMemo(() => {
		const booked = new Set<string>();
		const competitors = new Map<string, { cca_id: number }[]>();
		for (const slot of slots) {
			const key = `${slot.facility_id}|${slot.date}|${columnOfHour(slot.hour)}`;
			for (const claim of slot.claims) {
				if (claim.status === "approved") booked.add(key);
				if (claim.status === "pending" && !myCcaIds.has(claim.cca_id)) {
					competitors.set(key, [...(competitors.get(key) ?? []), claim]);
				}
			}
		}
		return { bookedCells: booked, competitorsByCell: competitors };
	}, [slots, myCcaIds]);

	const segments = useMemo(() => {
		// The list covers the current booking window, not a CCA's whole history.
		const from = getMondayOf(today);
		return groupClaimSegments(
			claims.filter(
				(claim) => claim.date >= from && (ccaFilter === null || claim.cca_id === ccaFilter),
			),
		).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
	}, [claims, ccaFilter, today]);

	function statusOf(segment: ClaimSegment<MyClaim>) {
		if (segment.status === "rejected") return "rejected";
		return isSlotPast(segment.date, segment.end - 1, today, currentHour) ? "past" : segment.status;
	}

	const visible =
		statusFilter === "all"
			? segments
			: segments.filter((segment) => statusOf(segment) === statusFilter);

	function noteFor(segment: ClaimSegment<MyClaim>): string {
		const cells = Array.from(
			{ length: segment.end - segment.start },
			(_, index) => `${segment.facility_id}|${segment.date}|${segment.start + index}`,
		);
		if (segment.status === "rejected") {
			return cells.some((cell) => bookedCells.has(cell))
				? "JCRC gave this slot to another CCA"
				: "JCRC declined this request";
		}
		if (segment.status !== "pending") return "";
		const others = new Set(
			cells.flatMap((cell) => (competitorsByCell.get(cell) ?? []).map((claim) => claim.cca_id)),
		);
		return others.size
			? `${others.size} other CCA${others.size > 1 ? "s" : ""} also asked for this time`
			: "";
	}

	async function cancel(segment: ClaimSegment<MyClaim>) {
		setBusy(true);
		try {
			await withdrawClaims(segment.claim_ids);
			toast.success(
				segment.status === "approved" ? "Booking cancelled · slot reopened" : "Request withdrawn",
			);
			setOpenKey(null);
			setConfirmKey(null);
			await onChanged();
		} catch (error) {
			toast.error(errorMessage(error, "Failed to withdraw"));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return (
			<div className="flex flex-wrap items-start gap-5">
				<Skeleton className="h-72 min-w-0 max-w-[820px] flex-[1_1_520px] rounded-[12px]" />
				<Skeleton className="h-64 max-w-80 flex-[1_1_240px] rounded-[12px]" />
			</div>
		);
	}

	return (
		<div className="flex flex-wrap items-start gap-5">
			<div className="min-w-0 max-w-[820px] flex-[1_1_520px]">
				<div className={cn(FACILITY_CARD_CLASS, "flex flex-col gap-3 p-4")}>
					{chairCcas.length > 1 && (
						<div className="flex flex-wrap gap-1.5">
							{[{ id: null, name: "All CCAs" }, ...chairCcas].map((cca) => (
								<button
									key={cca.id ?? "all"}
									type="button"
									aria-pressed={ccaFilter === cca.id}
									onClick={() => setCcaFilter(cca.id)}
									className={cn(
										"h-[26px] cursor-pointer rounded-full px-2.5 text-xs font-semibold",
										ccaFilter === cca.id
											? "bg-primary text-white"
											: "bg-muted text-muted-foreground",
									)}
								>
									{cca.name}
								</button>
							))}
						</div>
					)}
					{visible.length === 0 && (
						<FacilityEmpty compact>
							{segments.length === 0
								? "No requests yet. Pick a time on the calendar to request one."
								: "Nothing here for this filter."}
						</FacilityEmpty>
					)}
					<div className="flex flex-col gap-2">
						{visible.map((segment) => {
							const key = segment.claim_ids[0];
							const open = openKey === key;
							const confirming = confirmKey === key;
							const style = CLAIM_STATUS_STYLE[segment.status];
							const past = isSlotPast(segment.date, segment.end - 1, today, currentHour);
							const approved = segment.status === "approved";
							const venue = facilityLabel(segment.claims[0]);
							const span = formatHourSpan(segment.start, segment.end);
							const note = noteFor(segment);
							return (
								<div
									key={key}
									className={cn(
										"flex flex-col overflow-hidden rounded-[10px] border bg-card",
										open && "border-fac-soft-line shadow-sm",
										past && "opacity-60",
									)}
								>
									<button
										type="button"
										aria-expanded={open}
										onClick={() => {
											setOpenKey(open ? null : key);
											setConfirmKey(null);
										}}
										className={cn(
											"flex w-full cursor-pointer gap-3 p-2.5 text-left hover:bg-fac-tint",
											open && "bg-fac-tint",
										)}
									>
										<span className="flex w-11 flex-none flex-col items-center justify-center rounded-[8px] bg-muted py-1.5">
											<span className="text-[10px] font-bold text-muted-foreground">
												{weekdayLabel(segment.date).toUpperCase()}
											</span>
											<span className="text-[17px] font-bold leading-[1.1]">
												{dayOfMonth(segment.date)}
											</span>
										</span>
										<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
											<span className="flex items-center justify-between gap-1.5">
												<span className="truncate text-[13.5px] font-bold">{venue}</span>
												<span
													className={cn(
														"flex-none rounded-full px-2 py-0.5 text-[11px] font-bold",
														style.className,
													)}
												>
													{style.label}
												</span>
											</span>
											<span className="text-[12.5px]">
												{span} · {segment.cca_name}
											</span>
											{note && <span className="text-xs text-fac-warn-ink">{note}</span>}
										</span>
									</button>
									{open && (
										<div className="flex flex-col gap-2.5 border-t bg-background p-3">
											{confirming ? (
												<div className="flex flex-col gap-2.5">
													<span className="text-[13px] leading-[1.45]">
														{approved
															? `Cancel ${segment.cca_name}'s booking at ${venue} on ${formatDayLabel(segment.date)}, ${span}? The slot reopens for other CCAs.`
															: "Withdraw this request? JCRC won't see it any more."}
													</span>
													<div className="flex flex-wrap gap-2">
														<Button
															size="sm"
															variant="destructive"
															isLoading={busy}
															onClick={() => cancel(segment)}
															className="h-[34px] rounded-[10px] font-bold"
														>
															{approved ? "Yes, cancel booking" : "Yes, withdraw"}
														</Button>
														<Button
															size="sm"
															variant="outline"
															disabled={busy}
															onClick={() => setConfirmKey(null)}
															className="h-[34px] rounded-[10px] bg-card font-bold"
														>
															{approved ? "Keep booking" : "Keep request"}
														</Button>
													</div>
												</div>
											) : (
												<div className="flex flex-wrap gap-2">
													{gridDates.has(segment.date) && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => onViewOnGrid(segment.date)}
															className="h-[34px] rounded-[10px] bg-card font-bold"
														>
															View on grid
														</Button>
													)}
													{segment.status !== "rejected" && !past && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => setConfirmKey(key)}
															className="h-[34px] rounded-[10px] bg-card font-bold"
														>
															{approved ? "Cancel booking" : "Withdraw request"}
														</Button>
													)}
												</div>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<aside className="flex max-w-80 flex-[1_1_240px] flex-col gap-3">
				<div className={cn(FACILITY_CARD_CLASS, "flex flex-col gap-2.5 p-4")}>
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-[15px] font-bold">Overview</span>
						{statusFilter !== "all" && (
							<button
								type="button"
								onClick={() => setStatusFilter("all")}
								className="cursor-pointer text-[12.5px] font-semibold text-fac-primary-hover"
							>
								Show all
							</button>
						)}
					</div>
					{STATS.map((stat) => {
						const active = statusFilter === stat.key;
						return (
							<button
								key={stat.key}
								type="button"
								aria-pressed={active}
								onClick={() => {
									setStatusFilter(active ? "all" : stat.key);
									setOpenKey(null);
									setConfirmKey(null);
								}}
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left hover:bg-fac-tint",
									active ? "border-fac-soft-line bg-fac-tint" : "bg-card",
								)}
							>
								<span className={cn("size-2.5 flex-none rounded-full", stat.dot)} />
								<span className="flex-1 text-sm font-semibold">{stat.label}</span>
								<span className="text-[22px] font-bold tabular-nums">
									{segments.filter((segment) => statusOf(segment) === stat.key).length}
								</span>
							</button>
						);
					})}
					<span className="text-xs text-muted-foreground">Tap a status to filter the list.</span>
				</div>
			</aside>
		</div>
	);
}
