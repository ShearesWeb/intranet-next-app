"use client";

import { cn } from "@/lib/utils";
import { FacilitySlotWithClaims, SlotDisplayStatus, BOOKING_TYPE_CONFIG } from "@/types/facilities";

interface SlotCardProps {
	slot: FacilitySlotWithClaims;
	isChair: boolean;
	onClaim: (slot: FacilitySlotWithClaims) => void;
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

const STATUS_STYLES: Record<SlotDisplayStatus, { border: string; bg: string; label: string }> = {
	available: {
		border: "border-dashed border-muted-foreground/30",
		bg: "bg-muted/30",
		label: "Available",
	},
	"your-cca": { border: "border-[#10b981]", bg: "bg-[#10b981]/10", label: "Your CCA" },
	taken: { border: "border-[#64748b]", bg: "bg-[#64748b]/10", label: "Taken" },
	conflict: { border: "border-[#f87171]", bg: "bg-[#f87171]/10", label: "Conflict" },
	pending: { border: "border-[#fbbf24]", bg: "bg-[#fbbf24]/10", label: "Pending" },
};

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

export function SlotCard({ slot, isChair, onClaim }: SlotCardProps) {
	const status = getSlotStatus(slot);
	const styles = STATUS_STYLES[status];
	const typeConfig = BOOKING_TYPE_CONFIG[slot.type];
	const isClickable = status === "available" && isChair;

	return (
		<button
			disabled={!isClickable}
			onClick={() => isClickable && onClaim(slot)}
			className={cn(
				"flex w-full items-center gap-3 rounded-lg border-l-4 p-3 text-left transition-colors",
				styles.border,
				styles.bg,
				isClickable && "cursor-pointer hover:bg-accent/50",
				!isClickable && "cursor-default",
			)}
		>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">
						{formatTime(slot.time_from)} – {formatTime(slot.time_to)}
					</span>
					<span
						className="inline-block h-2 w-2 rounded-full shrink-0"
						style={{ backgroundColor: typeConfig.color }}
						title={typeConfig.label}
					/>
				</div>
				{status === "your-cca" && slot.user_cca_claim && (
					<p className="mt-0.5 text-xs text-[#10b981]">{slot.user_cca_claim.activity}</p>
				)}
				{status === "taken" && slot.claims.length > 0 && (
					<p className="mt-0.5 text-xs text-muted-foreground">{slot.claims[0].cca_name}</p>
				)}
				{status === "conflict" && (
					<p className="mt-0.5 text-xs text-[#f87171]">{slot.claims.length} CCAs competing</p>
				)}
			</div>
			<span
				className={cn(
					"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
					status === "available" && "text-muted-foreground",
					status === "your-cca" && "bg-[#10b981]/20 text-[#10b981]",
					status === "taken" && "bg-[#64748b]/20 text-[#94a3b8]",
					status === "conflict" && "bg-[#f87171]/20 text-[#f87171]",
					status === "pending" && "bg-[#fbbf24]/20 text-[#fbbf24]",
				)}
			>
				{styles.label}
			</span>
		</button>
	);
}
