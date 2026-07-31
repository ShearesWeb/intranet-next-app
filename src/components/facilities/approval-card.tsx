"use client";

import { useState } from "react";
import { BookingApprovalView, FACILITY_TYPE_CONFIG, formatHourRange } from "@/types/facilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApprovalCardProps {
	approval: BookingApprovalView;
	onChanged: () => void;
}

/** One booking awaiting JCRC action: approve a claimant or reject them all. */
export function ApprovalCard({ approval, onChanged }: ApprovalCardProps) {
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const typeConfig = FACILITY_TYPE_CONFIG[approval.booking.type];
	const contested = approval.claimants.length > 1;

	async function act(body: Record<string, unknown>, key: string, successMsg: string) {
		setBusyKey(key);
		try {
			const res = await fetch("/api/facilities/approvals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ booking_id: approval.booking.id, ...body }),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Action failed");
				return;
			}
			toast.success(successMsg);
			onChanged();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyKey(null);
		}
	}

	return (
		<div
			className={cn(
				"rounded-lg border p-4",
				contested ? "border-[#f87171]/30 bg-[#f87171]/5" : "border-[#f59e0b]/30 bg-[#f59e0b]/5",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeConfig.color }} />
						<span className="font-medium">
							{approval.booking.venue} — {approval.booking.sub_venue}
						</span>
					</div>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{approval.booking.booked_date} · {formatHourRange(approval.booking.hour)}
					</p>
				</div>
				<Badge variant="outline" className="border-[#fbbf24] bg-[#fbbf24]/10 text-[#fbbf24]">
					{approval.days_until_booking}d until booking
				</Badge>
			</div>

			<div className="mt-3 space-y-2">
				<p className="text-xs font-medium text-muted-foreground">
					{contested ? `${approval.claimants.length} CCAs competing:` : "1 CCA awaiting approval:"}
				</p>
				{approval.claimants.map((c) => (
					<div
						key={c.claim.id}
						className="flex items-center justify-between gap-2 rounded-md bg-background/50 px-3 py-2 text-sm"
					>
						<div className="min-w-0">
							<span className="font-medium">{c.cca_name}</span>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								{c.chair_name && <span>{c.chair_name}</span>}
								{c.chair_telegram && <span className="text-primary">@{c.chair_telegram}</span>}
							</div>
						</div>
						<Button
							size="sm"
							variant="outline"
							className="h-7 shrink-0 text-xs"
							isLoading={busyKey === `approve-${c.claim.id}`}
							loadingText="…"
							onClick={() =>
								act(
									{ action: "approve", winning_claim_id: c.claim.id },
									`approve-${c.claim.id}`,
									`Approved for ${c.cca_name}`,
								)
							}
						>
							Approve
						</Button>
					</div>
				))}
			</div>

			<div className="mt-3 flex justify-end">
				<Button
					size="sm"
					variant="destructive"
					isLoading={busyKey === "reject"}
					loadingText="Rejecting…"
					onClick={() => act({ action: "reject" }, "reject", "All claims rejected")}
				>
					Reject all
				</Button>
			</div>
		</div>
	);
}
