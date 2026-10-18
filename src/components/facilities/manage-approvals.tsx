"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	ApprovalClaimant,
	ConfirmedBookingView,
	FacilitySlot,
	SlotApprovalView,
	formatHourRange,
} from "@/types/facilities";
import { formatDisplayDate } from "@/lib/date";
import { toast } from "sonner";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { CalendarCheck, Inbox } from "lucide-react";

interface ApprovalsPayload {
	pending: SlotApprovalView[];
	confirmed: ConfirmedBookingView[];
}

interface PendingApprovalRow {
	slot: FacilitySlot;
	claimant: ApprovalClaimant;
	competingClaimIds: number[];
}

type BookingAction = "approve" | "reject" | "revoke";

interface BusyAction {
	claimId: number;
	action: BookingAction;
}

function compareSlots(a: FacilitySlot, b: FacilitySlot) {
	return a.date.localeCompare(b.date) || a.hour - b.hour;
}

function locationFor(slot: FacilitySlot) {
	return slot.sub_venue || slot.venue;
}

function BookingListHeader() {
	return (
		<div className="hidden grid-cols-[1fr_1fr_1.5fr_1.25fr_12rem] items-center gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground md:grid">
			<span>Date</span>
			<span>Time</span>
			<span>Location</span>
			<span>Booking CCA</span>
			<span>Actions</span>
		</div>
	);
}

function BookingDetails({ slot, ccaName }: { slot: FacilitySlot; ccaName: string }) {
	return (
		<>
			<div>
				<span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Date</span>
				<span className="font-medium tabular-nums">
					{formatDisplayDate(slot.date, { month: "short", day: "numeric", year: "numeric" })}
				</span>
			</div>
			<div>
				<span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Time</span>
				<span className="whitespace-nowrap tabular-nums">{formatHourRange(slot.hour)}</span>
			</div>
			<div>
				<span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
					Location
				</span>
				<span className="font-medium">{locationFor(slot)}</span>
			</div>
			<div>
				<span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
					Booking CCA
				</span>
				<span>{ccaName}</span>
			</div>
		</>
	);
}

/** JCRC approvals queue + upcoming confirmed bookings (revocable). */
export function ManageApprovals() {
	const [data, setData] = useState<ApprovalsPayload>({ pending: [], confirmed: [] });
	const [loading, setLoading] = useState(true);
	const [busyAction, setBusyAction] = useState<BusyAction | null>(null);

	const fetchApprovals = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/facilities/approvals");
			if (res.ok) {
				const json = await res.json();
				setData(json.data ?? { pending: [], confirmed: [] });
			} else {
				toast.error("Failed to load approvals");
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

	// Each claimant gets a row so JCRC can approve or deny one CCA at a time.
	const pendingRows = useMemo<PendingApprovalRow[]>(
		() =>
			data.pending
				.filter((approval) => isBookableFacilityType(approval.slot.type))
				.flatMap((approval) => {
					const competingClaimIds = approval.claimants.map((claimant) => claimant.claim.claim_id);
					return approval.claimants.map((claimant) => ({
						slot: approval.slot,
						claimant,
						competingClaimIds,
					}));
				})
				.sort((a, b) => compareSlots(a.slot, b.slot)),
		[data.pending],
	);

	const confirmed = useMemo(
		() =>
			data.confirmed
				.filter((booking) => isBookableFacilityType(booking.slot.type))
				.sort((a, b) => compareSlots(a.slot, b.slot)),
		[data.confirmed],
	);

	async function actOnBooking(
		action: BookingAction,
		claimId: number,
		successMessage: string,
		competingClaimIds?: number[],
	) {
		setBusyAction({ claimId, action });
		try {
			const res = await fetch("/api/facilities/approvals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action,
					claim_id: claimId,
					...(action === "approve" ? { competing_claim_ids: competingClaimIds } : {}),
				}),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Action failed");
				return;
			}
			toast.success(successMessage);
			await fetchApprovals();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyAction(null);
		}
	}

	if (loading) {
		return (
			<div className="space-y-8">
				<div className="space-y-3">
					<Skeleton className="h-5 w-36" />
					<Skeleton className="h-28 w-full" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-28 w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Awaiting approval</h3>
				{pendingRows.length === 0 ? (
					<EmptyState
						icon={Inbox}
						title="Nothing to approve"
						description="Every claim a CCA makes lands here for JCRC sign-off."
					/>
				) : (
					<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
						<BookingListHeader />
						<div className="divide-y">
							{pendingRows.map(({ slot, claimant, competingClaimIds }) => {
								const claimId = claimant.claim.claim_id;
								const location = locationFor(slot);
								return (
									<div
										key={claimId}
										className="grid gap-4 px-5 py-4 text-sm transition-colors hover:bg-muted/20 md:grid-cols-[1fr_1fr_1.5fr_1.25fr_12rem] md:items-center"
									>
										<BookingDetails slot={slot} ccaName={claimant.cca_name} />
										<div>
											<span className="mb-2 block text-xs font-medium text-muted-foreground md:hidden">
												Actions
											</span>
											<div className="flex items-center gap-2 md:justify-end">
												<Button
													size="sm"
													aria-label={`Approve ${claimant.cca_name} booking for ${location}`}
													isLoading={
														busyAction?.claimId === claimId && busyAction.action === "approve"
													}
													loadingText="Approving…"
													onClick={() =>
														actOnBooking(
															"approve",
															claimId,
															`Approved ${claimant.cca_name}'s booking`,
															competingClaimIds,
														)
													}
												>
													Approve
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
													aria-label={`Deny ${claimant.cca_name} booking for ${location}`}
													isLoading={
														busyAction?.claimId === claimId && busyAction.action === "reject"
													}
													loadingText="Denying…"
													onClick={() =>
														actOnBooking("reject", claimId, `Denied ${claimant.cca_name}'s booking`)
													}
												>
													Deny
												</Button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
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
					<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
						<BookingListHeader />
						<div className="divide-y">
							{confirmed.map((booking) => {
								const location = locationFor(booking.slot);
								return (
									<div
										key={booking.claim_id}
										className="grid gap-4 px-5 py-4 text-sm transition-colors hover:bg-muted/20 md:grid-cols-[1fr_1fr_1.5fr_1.25fr_12rem] md:items-center"
									>
										<BookingDetails slot={booking.slot} ccaName={booking.cca_name} />
										<div>
											<span className="mb-2 block text-xs font-medium text-muted-foreground md:hidden">
												Actions
											</span>
											<div className="flex md:justify-end">
												<Button
													size="sm"
													variant="destructive"
													aria-label={`Revoke ${booking.cca_name} booking for ${location}`}
													isLoading={
														busyAction?.claimId === booking.claim_id &&
														busyAction.action === "revoke"
													}
													loadingText="Revoking…"
													onClick={() =>
														actOnBooking(
															"revoke",
															booking.claim_id,
															"Booking revoked — slot reopened",
														)
													}
												>
													Revoke
												</Button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
