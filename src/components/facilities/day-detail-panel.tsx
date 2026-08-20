"use client";

import { useMemo, useState } from "react";
import {
	SlotWithContext,
	FACILITY_TYPE_CONFIG,
	SLOT_STATUS_CONFIG,
	MIN_BOOKING_LEAD_DAYS,
	formatHourRange,
	horizonOpensOn,
	isBeyondBookingHorizon,
	isBookingLocked,
} from "@/types/facilities";
import { CalendarClock, Lock } from "lucide-react";
import { DataTable, type DataTableColumnDef } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";

interface DayDetailPanelProps {
	date: string;
	bookings: SlotWithContext[];
	isChair: boolean;
	/** Explain absent REBOKS rows on days past the horizon. False for JCRC, who see them. */
	showHorizonNotice?: boolean;
	loading?: boolean;
	onClaim: (booking: SlotWithContext) => void;
	onWithdraw?: (claimId: number) => Promise<void> | void;
}

export function DayDetailPanel({
	date,
	bookings,
	isChair,
	showHorizonNotice = false,
	loading,
	onClaim,
	onWithdraw,
}: DayDetailPanelProps) {
	const sorted = useMemo(
		() =>
			[...bookings].sort((a, b) => {
				const vCmp = a.sub_venue.localeCompare(b.sub_venue);
				if (vCmp !== 0) return vCmp;
				return a.hour - b.hour;
			}),
		[bookings],
	);

	const columns = useMemo<DataTableColumnDef<SlotWithContext>[]>(() => {
		const cols: DataTableColumnDef<SlotWithContext>[] = [
			{
				id: "venue",
				header: "Venue",
				accessorFn: (b) => `${b.sub_venue} ${b.venue}`,
				cell: ({ row }) => {
					const b = row.original;
					return (
						<div>
							<div className="flex items-center gap-1.5 font-medium">{b.venue}</div>
							<div className="text-xs text-muted-foreground">{b.sub_venue}</div>
						</div>
					);
				},
			},
			{
				id: "time",
				header: "Time",
				accessorKey: "hour",
				cell: ({ row }) => (
					<span className="whitespace-nowrap tabular-nums">
						{formatHourRange(row.original.hour)}
					</span>
				),
			},
			{
				id: "type",
				header: "Type",
				accessorFn: (b) => FACILITY_TYPE_CONFIG[b.type].label,
				cell: ({ row }) => {
					const typeConfig = FACILITY_TYPE_CONFIG[row.original.type];
					return (
						<span className="inline-flex items-center gap-1.5">
							<span
								className="h-2 w-2 rounded-full shrink-0"
								style={{ backgroundColor: typeConfig.color }}
							/>
							<span className="text-muted-foreground">{typeConfig.label}</span>
						</span>
					);
				},
			},
			{
				id: "status",
				header: "Status",
				accessorFn: (b) => SLOT_STATUS_CONFIG[b.status].label,
				cell: ({ row }) => {
					const b = row.original;
					const statusConfig = SLOT_STATUS_CONFIG[b.status];
					const myClaim = b.user_cca_claim;
					const myClaimActive =
						myClaim && (myClaim.status === "pending" || myClaim.status === "approved");
					return (
						<div>
							<StatusPill label={statusConfig.label} color={statusConfig.color} />
							{myClaimActive && (
								<div className="mt-0.5 text-xs text-muted-foreground">
									Your CCA: {myClaim.cca_name}
								</div>
							)}
						</div>
					);
				},
			},
		];

		if (isChair) {
			cols.push({
				id: "actions",
				header: "",
				enableHiding: false,
				cell: ({ row }) => (
					<BookingActions
						booking={row.original}
						locked={isBookingLocked(date)}
						onClaim={onClaim}
						onWithdraw={onWithdraw}
					/>
				),
			});
		}

		return cols;
	}, [isChair, date, onClaim, onWithdraw]);

	const locked = isBookingLocked(date);
	// Without this the day just renders short of its REBOKS rows and reads as a
	// bug. The rule is stated where the absence is noticed.
	const beyondHorizon = showHorizonNotice && isBeyondBookingHorizon(date);

	return (
		<div className="flex-1 min-w-0">
			<h3 className="mb-3 text-lg font-semibold">{formatDisplayDate(date)}</h3>
			{locked && (
				<p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
					<Lock className="h-3.5 w-3.5" />
					Bookings lock {MIN_BOOKING_LEAD_DAYS} days before the date — new claims are closed for
					this day.
				</p>
			)}
			{beyondHorizon && (
				<p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
					<CalendarClock className="h-3.5 w-3.5" />
					REBOKS courts are secured a month at a time — they open for this day on{" "}
					{formatDisplayDate(horizonOpensOn(date))}. Hall venues can still be booked.
				</p>
			)}
			<DataTable
				data={sorted}
				columns={columns}
				searchColumn="venue"
				searchPlaceholder="Search venues..."
				pageSize={10}
				emptyMessage="No bookings on this day."
				isLoading={loading}
				tablePadding="[&_th]:px-3 [&_td]:px-3 py-2.5"
			/>
		</div>
	);
}

function BookingActions({
	booking,
	locked,
	onClaim,
	onWithdraw,
}: {
	booking: SlotWithContext;
	locked: boolean;
	onClaim: (booking: SlotWithContext) => void;
	onWithdraw?: (claimId: number) => Promise<void> | void;
}) {
	const [busy, setBusy] = useState(false);

	const myClaim = booking.user_cca_claim;
	const myClaimActive = myClaim && (myClaim.status === "pending" || myClaim.status === "approved");
	// New claims respect the lead-time lock; withdrawing an existing claim never does.
	const canClaim = !myClaimActive && booking.status !== "confirmed" && !locked;

	async function handleWithdraw(claimId: number) {
		if (!onWithdraw) return;
		setBusy(true);
		try {
			await onWithdraw(claimId);
		} finally {
			setBusy(false);
		}
	}

	if (myClaimActive && onWithdraw) {
		return (
			<Button
				size="sm"
				variant="destructive"
				className="h-7 text-xs"
				isLoading={busy}
				loadingText="Withdrawing…"
				onClick={() => handleWithdraw(myClaim!.claim_id)}
			>
				Withdraw
			</Button>
		);
	}

	if (!canClaim) return null;

	return (
		<Button
			size="sm"
			variant="outline"
			className={cn(
				"h-7 text-xs transition-colors",
				booking.status === "available"
					? "hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
					: "text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10",
			)}
			onClick={() => onClaim(booking)}
		>
			{booking.status === "available" ? "Claim" : "Dispute"}
		</Button>
	);
}
