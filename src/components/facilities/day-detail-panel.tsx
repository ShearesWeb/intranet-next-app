"use client";

import { useMemo, useState } from "react";
import {
	BookingWithClaims,
	FACILITY_TYPE_CONFIG,
	BOOKING_STATUS_CONFIG,
	MIN_BOOKING_LEAD_DAYS,
	formatHourRange,
	isBookingLocked,
} from "@/types/facilities";
import { Lock } from "lucide-react";
import { DataTable, type DataTableColumnDef } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";
import { Repeat } from "lucide-react";

interface DayDetailPanelProps {
	date: string;
	bookings: BookingWithClaims[];
	isChair: boolean;
	loading?: boolean;
	onClaim: (booking: BookingWithClaims) => void;
	onWithdraw?: (claimId: number) => Promise<void> | void;
}

export function DayDetailPanel({
	date,
	bookings,
	isChair,
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

	const columns = useMemo<DataTableColumnDef<BookingWithClaims>[]>(() => {
		const cols: DataTableColumnDef<BookingWithClaims>[] = [
			{
				id: "venue",
				header: "Venue",
				accessorFn: (b) => `${b.sub_venue} ${b.venue}`,
				cell: ({ row }) => {
					const b = row.original;
					return (
						<div>
							<div className="flex items-center gap-1.5 font-medium">
								{b.sub_venue}
								{b.recurring && <Repeat className="h-3 w-3 text-muted-foreground" />}
							</div>
							{b.venue !== b.sub_venue && (
								<div className="text-xs text-muted-foreground">{b.venue}</div>
							)}
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
				accessorFn: (b) => BOOKING_STATUS_CONFIG[b.status].label,
				cell: ({ row }) => {
					const b = row.original;
					const statusConfig = BOOKING_STATUS_CONFIG[b.status];
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
	booking: BookingWithClaims;
	locked: boolean;
	onClaim: (booking: BookingWithClaims) => void;
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
				onClick={() => handleWithdraw(myClaim!.id)}
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
