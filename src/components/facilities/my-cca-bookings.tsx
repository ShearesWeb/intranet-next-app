"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ClaimStatus,
	CLAIM_STATUS_CONFIG,
	FACILITY_TYPE_CONFIG,
	FacilityBooking,
	formatHourRange,
} from "@/types/facilities";
import { toast } from "sonner";
import { Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimRow {
	id: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	booking: FacilityBooking | null;
}

function formatDate(dateStr: string): string {
	return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

/**
 * A CCA chair's upcoming bookings + conflict awareness. Conflicts are read-only
 * here — JCRC resolves them on the admin page.
 */
export function MyCcaBookings() {
	const { user } = useAuth();
	const [claims, setClaims] = useState<ClaimRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [ccaFilter, setCcaFilter] = useState<number | null>(null);
	const [busyId, setBusyId] = useState<number | null>(null);

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
			setClaims(results.flat());
		} catch {
			toast.error("Failed to load bookings");
		} finally {
			setLoading(false);
		}
	}, [chairCcaIds]);

	useEffect(() => {
		fetchClaims();
	}, [fetchClaims]);

	const visible = useMemo(() => {
		const list = ccaFilter === null ? claims : claims.filter((c) => c.cca_id === ccaFilter);
		return [...list].sort((a, b) => {
			const da = a.booking?.booked_date ?? "";
			const db = b.booking?.booked_date ?? "";
			return db.localeCompare(da);
		});
	}, [claims, ccaFilter]);

	async function handleWithdraw(claimId: number) {
		setBusyId(claimId);
		try {
			const res = await fetch(`/api/facilities/claims/${claimId}`, { method: "DELETE" });
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to withdraw");
				return;
			}
			toast.success("Booking withdrawn");
			fetchClaims();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyId(null);
		}
	}

	if (chairCcas.length === 0) return null;

	return (
		<div className="space-y-3">
			<h2 className="text-lg font-semibold">My CCA bookings</h2>

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

			{loading ? (
				<div className="space-y-3">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : visible.length === 0 ? (
				<EmptyState
					icon={Calendar}
					title="No bookings yet"
					description="Claim a slot above to see it here."
				/>
			) : (
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
								<th className="px-3 py-2">Venue</th>
								<th className="px-3 py-2">When</th>
								<th className="px-3 py-2">CCA</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2 w-[1%]" />
							</tr>
						</thead>
						<tbody>
							{visible.map((claim) => {
								const b = claim.booking;
								const statusConfig = CLAIM_STATUS_CONFIG[claim.status];
								const typeConfig = b ? FACILITY_TYPE_CONFIG[b.type] : null;
								const canWithdraw = claim.status === "pending" || claim.status === "approved";
								const conflicted = b?.status === "conflicted";
								return (
									<tr key={claim.id} className="border-b last:border-0 hover:bg-accent/50">
										<td className="px-3 py-2.5">
											{b ? (
												<>
													<div className="font-medium">{b.sub_venue}</div>
													{b.venue !== b.sub_venue && (
														<div className="text-xs text-muted-foreground">{b.venue}</div>
													)}
												</>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</td>
										<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
											{b ? (
												<span className="inline-flex items-center gap-1.5">
													{typeConfig && (
														<span
															className="h-2 w-2 rounded-full shrink-0"
															style={{ backgroundColor: typeConfig.color }}
														/>
													)}
													{formatDate(b.booked_date)} · {formatHourRange(b.hour)}
												</span>
											) : (
												"—"
											)}
										</td>
										<td className="px-3 py-2.5">{claim.cca_name}</td>
										<td className="px-3 py-2.5">
											<div className="flex flex-col gap-1">
												<Badge
													variant="outline"
													style={{ borderColor: statusConfig.color, color: statusConfig.color }}
												>
													{statusConfig.label}
												</Badge>
												{conflicted && (
													<span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
														<AlertTriangle className="h-3 w-3" />
														JCRC resolving
													</span>
												)}
											</div>
										</td>
										<td className="px-3 py-2.5 whitespace-nowrap">
											{canWithdraw && (
												<Button
													size="sm"
													variant="outline"
													className="h-7 text-xs"
													isLoading={busyId === claim.id}
													loadingText="Withdrawing…"
													onClick={() => handleWithdraw(claim.id)}
												>
													Withdraw
												</Button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
