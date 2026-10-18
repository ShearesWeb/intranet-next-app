"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ClaimStatus,
	CLAIM_STATUS_CONFIG,
	FacilityType,
	formatHourRange,
} from "@/types/facilities";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";

interface ClaimRow {
	id: number;
	facility_id: number;
	date: string;
	hour: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	venue: string;
	sub_venue: string;
	facility_type: FacilityType;
}

/** A chair's claims in one newest-first list, with status shown on each row. */
export function MyCcaBookings() {
	const { user } = useAuth();
	const [claims, setClaims] = useState<ClaimRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [ccaFilter, setCcaFilter] = useState<number | null>(null);
	const [cancellingId, setCancellingId] = useState<number | null>(null);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const chairCcaIds = useMemo(() => chairCcas.map((c) => c.id), [chairCcas]);

	const fetchClaims = useCallback(async () => {
		if (chairCcaIds.length === 0) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const results = await Promise.all(
				chairCcaIds.map((id) =>
					fetch(`/api/facilities/claims?ccaId=${id}`)
						.then((r) => (r.ok ? r.json() : { data: [] }))
						.then((j) => (j.data ?? []) as ClaimRow[]),
				),
			);
			// A booking a chair can no longer manage is more confusing shown than
			// hidden, so parked venue types drop out of the list here too.
			setClaims(results.flat().filter((c) => isBookableFacilityType(c.facility_type)));
		} catch {
			toast.error("Failed to load bookings");
		} finally {
			setLoading(false);
		}
	}, [chairCcaIds]);

	useEffect(() => {
		fetchClaims();
	}, [fetchClaims]);

	const visibleClaims = useMemo(() => {
		const filtered =
			ccaFilter === null ? claims : claims.filter((claim) => claim.cca_id === ccaFilter);
		return [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour);
	}, [claims, ccaFilter]);

	async function handleCancel(claimId: number) {
		setCancellingId(claimId);
		try {
			const response = await fetch(`/api/facilities/claims/${claimId}`, { method: "DELETE" });
			if (!response.ok) {
				const json = await response.json();
				toast.error(json.error ?? "Failed to cancel booking");
				return;
			}

			toast.success("Booking cancelled");
			await fetchClaims();
		} catch {
			toast.error("Network error — please try again");
		} finally {
			setCancellingId(null);
		}
	}

	if (chairCcas.length === 0) return null;

	if (loading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{chairCcas.length > 1 && (
				<div className="flex flex-wrap gap-1.5">
					<button
						onClick={() => setCcaFilter(null)}
						className={cn(
							"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95",
							ccaFilter === null
								? "bg-primary text-primary-foreground shadow-sm"
								: "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
					>
						All CCAs
					</button>
					{chairCcas.map((cca) => (
						<button
							key={cca.id}
							onClick={() => setCcaFilter(ccaFilter === cca.id ? null : cca.id)}
							className={cn(
								"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95",
								ccaFilter === cca.id
									? "bg-primary text-primary-foreground shadow-sm"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{cca.name}
						</button>
					))}
				</div>
			)}

			{visibleClaims.length === 0 ? (
				<EmptyState
					icon={Calendar}
					title="No bookings"
					description="Slots you claim show up here."
				/>
			) : (
				<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="hidden grid-cols-[1fr_1fr_1.5fr_1.25fr_auto_auto] gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
						<span>Date</span>
						<span>Time</span>
						<span>Location</span>
						<span>Booking CCA</span>
						<span className="w-24">Status</span>
						<span className="w-24">Actions</span>
					</div>
					<div className="divide-y">
						{visibleClaims.map((claim) => (
							<BookingRow
								key={claim.id}
								claim={claim}
								cancelling={cancellingId === claim.id}
								onCancel={handleCancel}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function BookingRow({
	claim,
	cancelling,
	onCancel,
}: {
	claim: ClaimRow;
	cancelling: boolean;
	onCancel: (claimId: number) => void;
}) {
	const statusConfig = CLAIM_STATUS_CONFIG[claim.status];
	const canCancel = claim.status === "approved" || claim.status === "pending";

	return (
		<div className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_1fr_1.5fr_1.25fr_auto_auto] md:items-center md:gap-4">
			<div>
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Date</span>
				<span className="font-medium">
					{formatDisplayDate(claim.date, { month: "short", day: "numeric", year: "numeric" })}
				</span>
			</div>
			<div>
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Time</span>
				<span>{formatHourRange(claim.hour)}</span>
			</div>
			<div className="min-w-0">
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Location</span>
				<span className="block truncate">{claim.sub_venue}</span>
			</div>
			<div className="min-w-0">
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Booking CCA</span>
				<span className="block truncate">{claim.cca_name}</span>
			</div>
			<div className="md:w-24">
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Status</span>
				<Badge
					variant="outline"
					style={{
						backgroundColor: `${statusConfig.color}1a`,
						borderColor: `${statusConfig.color}33`,
						color: statusConfig.color,
					}}
				>
					{statusConfig.label}
				</Badge>
			</div>
			<div className="md:w-24">
				<span className="mb-1 block text-xs text-muted-foreground md:hidden">Actions</span>
				{canCancel && (
					<Button
						size="sm"
						variant="destructive"
						className="h-8 text-xs"
						aria-label={`Cancel ${claim.sub_venue} booking`}
						isLoading={cancelling}
						loadingText="Cancelling…"
						onClick={() => onCancel(claim.id)}
					>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
}
