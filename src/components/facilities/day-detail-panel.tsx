"use client";

import { useState } from "react";
import { FacilitySlotWithClaims, BOOKING_TYPE_CONFIG, SlotDisplayStatus } from "@/types/facilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DayDetailPanelProps {
	date: string;
	slots: FacilitySlotWithClaims[];
	isChair: boolean;
	loading?: boolean;
	onClaim: (slot: FacilitySlotWithClaims) => void;
	onRelease?: (claimId: number) => Promise<void> | void;
}

function formatDisplayDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

function getSlotStatus(slot: FacilitySlotWithClaims): SlotDisplayStatus {
	if (slot.user_cca_claim) {
		if (slot.user_cca_claim.status === "conflicted") return "conflict";
		if (slot.user_cca_claim.status === "pending") return "pending";
		return "your-cca";
	}
	const activeClaims = slot.claims.filter(
		(c) => c.status === "approved" || c.status === "conflicted" || c.status === "pending",
	);
	if (activeClaims.length === 0) return "available";
	if (activeClaims.some((c) => c.status === "conflicted")) return "conflict";
	return "taken";
}

const STATUS_BADGE: Record<SlotDisplayStatus, { text: string; className: string }> = {
	available: { text: "Available", className: "text-muted-foreground" },
	"your-cca": { text: "Approved", className: "bg-[#10b981]/15 text-[#10b981]" },
	taken: { text: "Approved", className: "bg-[#10b981]/15 text-[#10b981]" },
	conflict: { text: "Conflict", className: "bg-[#f87171]/15 text-[#f87171]" },
	pending: { text: "Pending", className: "bg-[#fbbf24]/15 text-[#fbbf24]" },
};

export function DayDetailPanel({
	date,
	slots,
	isChair,
	loading,
	onClaim,
	onRelease,
}: DayDetailPanelProps) {
	const sorted = [...slots].sort((a, b) => {
		const vCmp = a.sub_venue.localeCompare(b.sub_venue);
		if (vCmp !== 0) return vCmp;
		return a.time_from.localeCompare(b.time_from);
	});

	return (
		<div className="flex-1 min-w-0">
			<h3 className="mb-3 text-lg font-semibold">{formatDisplayDate(date)}</h3>

			{loading ? (
				<div className="overflow-hidden rounded-lg border">
					<div className="border-b bg-muted/50 px-3 py-2">
						<Skeleton className="h-4 w-24" />
					</div>
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="flex items-center gap-4 border-b px-3 py-3 last:border-0">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="ml-auto h-4 w-16" />
						</div>
					))}
				</div>
			) : sorted.length === 0 ? (
				<p className="text-sm text-muted-foreground">No available slots on this day.</p>
			) : (
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
								<th className="px-3 py-2">Venue</th>
								<th className="px-3 py-2">Time</th>
								<th className="px-3 py-2">Type</th>
								<th className="px-3 py-2">Status</th>
								{isChair && <th className="px-3 py-2 w-[1%]" />}
							</tr>
						</thead>
						<tbody>
							{sorted.map((slot) => (
								<SlotRow
									key={slot.id}
									slot={slot}
									isChair={isChair}
									onClaim={onClaim}
									onRelease={onRelease}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function SlotRow({
	slot,
	isChair,
	onClaim,
	onRelease,
}: {
	slot: FacilitySlotWithClaims;
	isChair: boolean;
	onClaim: (slot: FacilitySlotWithClaims) => void;
	onRelease?: (claimId: number) => Promise<void> | void;
}) {
	const [releasing, setReleasing] = useState(false);
	const status = getSlotStatus(slot);
	const badge = STATUS_BADGE[status];
	const typeConfig = BOOKING_TYPE_CONFIG[slot.type];
	const canClaim = status === "available" && isChair;

	async function handleRelease(claimId: number) {
		if (!onRelease) return;
		setReleasing(true);
		try {
			await onRelease(claimId);
		} finally {
			setReleasing(false);
		}
	}

	return (
		<tr className="group border-b last:border-0 hover:bg-accent/50 transition-colors">
			<td className="px-3 py-2.5">
				<div className="font-medium">{slot.sub_venue}</div>
				{slot.venue !== slot.sub_venue && (
					<div className="text-xs text-muted-foreground">{slot.venue}</div>
				)}
			</td>
			<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
				{formatTime(slot.time_from)} – {formatTime(slot.time_to)}
			</td>
			<td className="px-3 py-2.5">
				<span className="inline-flex items-center gap-1.5">
					<span
						className="h-2 w-2 rounded-full shrink-0"
						style={{ backgroundColor: typeConfig.color }}
					/>
					<span className="text-muted-foreground">{typeConfig.label}</span>
				</span>
			</td>
			<td className="px-3 py-2.5">
				<span
					className={cn(
						"inline-block rounded-full px-2 py-0.5 text-xs font-medium",
						badge.className,
					)}
				>
					{badge.text}
				</span>
				{slot.claims.length > 0 && status !== "available" && (
					<div className="mt-0.5 text-xs text-muted-foreground">
						{slot.claims[0].cca_name}
						{slot.claims[0].activity && ` — ${slot.claims[0].activity}`}
					</div>
				)}
				{status === "conflict" && slot.claims.length > 1 && (
					<div className="text-xs text-[#f87171]">{slot.claims.length} CCAs competing</div>
				)}
			</td>
			{isChair && (
				<td className="px-3 py-2.5 whitespace-nowrap">
					{canClaim && (
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs transition-colors group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:text-primary"
							onClick={() => onClaim(slot)}
						>
							Claim
						</Button>
					)}
					{status === "your-cca" && slot.user_cca_claim && onRelease && (
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs"
							isLoading={releasing}
							loadingText="Releasing…"
							onClick={() => handleRelease(slot.user_cca_claim!.id)}
						>
							Release
						</Button>
					)}
					{status === "taken" && (
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs text-[#f87171] border-[#f87171]/30 hover:bg-[#f87171]/10 group-hover:border-[#f87171]/50"
							onClick={() => onClaim(slot)}
						>
							Dispute
						</Button>
					)}
				</td>
			)}
		</tr>
	);
}
