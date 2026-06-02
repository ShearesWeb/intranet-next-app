"use client";

import { ConflictView, BOOKING_TYPE_CONFIG } from "@/types/facilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

interface ConflictCardProps {
	conflict: ConflictView;
	userCcaIds: number[];
	onYield: () => void;
	showOverride?: boolean;
	onOverride?: (facilityId: number, winningCcaId: number) => void;
}

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

export function ConflictCard({
	conflict,
	userCcaIds,
	onYield,
	showOverride,
	onOverride,
}: ConflictCardProps) {
	const [yielding, setYielding] = useState(false);
	const typeConfig = BOOKING_TYPE_CONFIG[conflict.facility.type];

	const userClaim = conflict.claimants.find((c) => userCcaIds.includes(c.claim.cca_id));

	async function handleYield() {
		if (!userClaim) return;
		setYielding(true);
		try {
			const res = await fetch(`/api/facilities/claims/${userClaim.claim.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "yielded" }),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to yield");
				return;
			}
			toast.success("Yielded slot successfully");
			onYield();
		} catch {
			toast.error("Network error");
		} finally {
			setYielding(false);
		}
	}

	return (
		<div className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/5 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeConfig.color }} />
						<span className="font-medium">
							{conflict.facility.venue} — {conflict.facility.sub_venue}
						</span>
					</div>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{conflict.facility.booked_date} · {formatTime(conflict.facility.time_from)} –{" "}
						{formatTime(conflict.facility.time_to)}
					</p>
				</div>
				<Badge
					variant="outline"
					className={
						conflict.escalated
							? "border-[#f87171] bg-[#f87171]/10 text-[#f87171]"
							: "border-[#fbbf24] bg-[#fbbf24]/10 text-[#fbbf24]"
					}
				>
					{conflict.escalated ? "Escalated" : `${conflict.days_until_booking}d until booking`}
				</Badge>
			</div>

			<div className="mt-3 space-y-2">
				<p className="text-xs font-medium text-muted-foreground">
					{conflict.claimants.length} CCAs competing:
				</p>
				{conflict.claimants.map((c) => (
					<div
						key={c.claim.id}
						className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2 text-sm"
					>
						<div>
							<span className="font-medium">{c.cca_name}</span>
							<span className="ml-2 text-muted-foreground">— {c.claim.activity}</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{c.chair_name}</span>
							{c.chair_telegram && <span className="text-primary">@{c.chair_telegram}</span>}
							{c.claim.status === "yielded" && (
								<Badge variant="secondary" className="text-[10px]">
									Yielded
								</Badge>
							)}
						</div>
					</div>
				))}
			</div>

			<div className="mt-3 flex items-center justify-between">
				{!conflict.escalated && (
					<p className="text-xs text-muted-foreground">
						Auto-escalates in {Math.max(0, conflict.days_until_booking - 3)} day
						{conflict.days_until_booking - 3 !== 1 ? "s" : ""}
					</p>
				)}
				<div className="ml-auto flex gap-2">
					{userClaim && userClaim.claim.status === "conflicted" && (
						<Button size="sm" variant="destructive" onClick={handleYield} disabled={yielding}>
							{yielding ? "Yielding..." : "Yield"}
						</Button>
					)}
					{showOverride && onOverride && (
						<OverrideDropdown
							claimants={conflict.claimants}
							onSelect={(ccaId) => onOverride(conflict.facility.id, ccaId)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

function OverrideDropdown({
	claimants,
	onSelect,
}: {
	claimants: ConflictView["claimants"];
	onSelect: (ccaId: number) => void;
}) {
	const activeClaims = claimants.filter((c) => c.claim.status === "conflicted");

	return (
		<div className="flex gap-1">
			{activeClaims.map((c) => (
				<Button
					key={c.claim.id}
					size="sm"
					variant="outline"
					onClick={() => onSelect(c.claim.cca_id)}
				>
					Assign to {c.cca_name}
				</Button>
			))}
		</div>
	);
}
