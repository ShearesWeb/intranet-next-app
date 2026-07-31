"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { ApprovalCard } from "@/components/facilities/approval-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	BookingApprovalView,
	ConfirmedBookingView,
	FACILITY_TYPE_CONFIG,
	formatHourRange,
} from "@/types/facilities";
import { toast } from "sonner";
import { CalendarCheck, Inbox } from "lucide-react";

interface ApprovalsPayload {
	pending: BookingApprovalView[];
	confirmed: ConfirmedBookingView[];
}

/** JCRC approvals queue + upcoming confirmed bookings (revocable). */
export function ManageApprovals() {
	const [data, setData] = useState<ApprovalsPayload>({ pending: [], confirmed: [] });
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<number | null>(null);

	const fetchApprovals = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/facilities/approvals");
			if (res.ok) {
				const json = await res.json();
				setData(json.data ?? { pending: [], confirmed: [] });
			}
		} catch {
			toast.error("Failed to load approvals");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchApprovals();
	}, [fetchApprovals]);

	const pending = useMemo(
		() => [...data.pending].sort((a, b) => a.days_until_booking - b.days_until_booking),
		[data.pending],
	);

	async function revoke(bookingId: number) {
		setBusyId(bookingId);
		try {
			const res = await fetch("/api/facilities/approvals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "revoke", booking_id: bookingId }),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to revoke");
				return;
			}
			toast.success("Booking revoked — slot reopened");
			fetchApprovals();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyId(null);
		}
	}

	if (loading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-28 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Awaiting approval</h3>
				{pending.length === 0 ? (
					<EmptyState
						icon={Inbox}
						title="Nothing to approve"
						description="Every claim a CCA makes lands here for JCRC sign-off."
					/>
				) : (
					pending.map((approval) => (
						<ApprovalCard
							key={approval.booking.id}
							approval={approval}
							onChanged={fetchApprovals}
						/>
					))
				)}
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Upcoming confirmed bookings</h3>
				{data.confirmed.length === 0 ? (
					<EmptyState
						icon={CalendarCheck}
						title="No upcoming confirmed bookings"
						description="Approved bookings show here and can be revoked."
					/>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
									<th className="px-3 py-2">Venue</th>
									<th className="px-3 py-2">When</th>
									<th className="px-3 py-2">CCA</th>
									<th className="px-3 py-2 w-[1%]" />
								</tr>
							</thead>
							<tbody>
								{data.confirmed.map((row) => {
									const typeConfig = FACILITY_TYPE_CONFIG[row.booking.type];
									return (
										<tr key={row.booking.id} className="border-b last:border-0 hover:bg-accent/50">
											<td className="px-3 py-2.5">
												<div className="font-medium">{row.booking.sub_venue}</div>
												{row.booking.venue !== row.booking.sub_venue && (
													<div className="text-xs text-muted-foreground">{row.booking.venue}</div>
												)}
											</td>
											<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
												<span className="inline-flex items-center gap-1.5">
													<span
														className="h-2 w-2 rounded-full shrink-0"
														style={{ backgroundColor: typeConfig.color }}
													/>
													{row.booking.booked_date} · {formatHourRange(row.booking.hour)}
												</span>
											</td>
											<td className="px-3 py-2.5">{row.cca_name}</td>
											<td className="px-3 py-2.5 whitespace-nowrap">
												<Button
													size="sm"
													variant="destructive"
													className="h-7 text-xs"
													isLoading={busyId === row.booking.id}
													loadingText="Revoking…"
													onClick={() => revoke(row.booking.id)}
												>
													Revoke
												</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}
