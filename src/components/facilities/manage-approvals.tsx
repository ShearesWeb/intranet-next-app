"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { ApprovalCard } from "@/components/facilities/approval-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	SlotApprovalView,
	ConfirmedBookingView,
	FACILITY_TYPE_CONFIG,
	formatHourRange,
	slotKey,
} from "@/types/facilities";
import { toast } from "sonner";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { CalendarCheck, Inbox } from "lucide-react";

interface ApprovalsPayload {
	pending: SlotApprovalView[];
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

	// Parked venue types stay out of the queue and the confirmed list, so JCRC
	// never sees a REBOKS claim it can no longer act on through the intranet.
	const pending = useMemo(
		() =>
			data.pending
				.filter((a) => isBookableFacilityType(a.slot.type))
				.sort((a, b) => a.days_until_booking - b.days_until_booking),
		[data.pending],
	);
	const confirmed = useMemo(
		() => data.confirmed.filter((c) => isBookableFacilityType(c.slot.type)),
		[data.confirmed],
	);

	async function revoke(claimId: number) {
		setBusyId(claimId);
		try {
			const res = await fetch("/api/facilities/approvals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "revoke", claim_id: claimId }),
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
							key={slotKey(approval.slot.facility_id, approval.slot.date, approval.slot.hour)}
							approval={approval}
							onChanged={fetchApprovals}
						/>
					))
				)}
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Upcoming confirmed bookings</h3>
				{confirmed.length === 0 ? (
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
								{confirmed.map((row) => {
									const typeConfig = FACILITY_TYPE_CONFIG[row.slot.type];
									return (
										<tr
											key={slotKey(row.slot.facility_id, row.slot.date, row.slot.hour)}
											className="border-b last:border-0 hover:bg-accent/50"
										>
											<td className="px-3 py-2.5">
												<div className="font-medium">{row.slot.venue}</div>
												<div className="text-xs text-muted-foreground">{row.slot.sub_venue}</div>
											</td>
											<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
												<span className="inline-flex items-center gap-1.5">
													<span
														className="h-2 w-2 rounded-full shrink-0"
														style={{ backgroundColor: typeConfig.color }}
													/>
													{row.slot.date} · {formatHourRange(row.slot.hour)}
												</span>
											</td>
											<td className="px-3 py-2.5">{row.cca_name}</td>
											<td className="px-3 py-2.5 whitespace-nowrap">
												<Button
													size="sm"
													variant="destructive"
													className="h-7 text-xs"
													isLoading={busyId === row.claim_id}
													loadingText="Revoking…"
													onClick={() => revoke(row.claim_id)}
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
