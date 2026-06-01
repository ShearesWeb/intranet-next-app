"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { MonthGrid } from "@/components/facilities/month-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	FacilitySlotWithClaims,
	CLAIM_STATUS_CONFIG,
	BOOKING_TYPE_CONFIG,
	ClaimStatus,
} from "@/types/facilities";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

function getMonthRange(year: number, month: number) {
	const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

function formatDisplayDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function MyBookingsPage() {
	const { user } = useAuth();
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());
	const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split("T")[0]);
	const [slots, setSlots] = useState<FacilitySlotWithClaims[]>([]);
	const [loading, setLoading] = useState(true);
	const [ccaFilter, setCcaFilter] = useState<number | null>(null);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const chairCcaIds = useMemo(() => chairCcas.map((c) => c.id), [chairCcas]);

	const fetchSlots = useCallback(async () => {
		const { start, end } = getMonthRange(year, month);
		setLoading(true);
		try {
			const res = await fetch(`/api/facilities/slots?start=${start}&end=${end}`);
			const json = await res.json();
			if (res.ok) {
				const all: FacilitySlotWithClaims[] = json.data ?? [];
				const myCcaSlots = all.filter((s) =>
					s.claims.some(
						(c) =>
							chairCcaIds.includes(c.cca_id) && c.status !== "cancelled" && c.status !== "yielded",
					),
				);
				setSlots(myCcaSlots);
			}
		} catch {
			toast.error("Failed to load bookings");
		} finally {
			setLoading(false);
		}
	}, [year, month, chairCcaIds]);

	useEffect(() => {
		fetchSlots();
	}, [fetchSlots]);

	const filteredSlots = useMemo(() => {
		if (ccaFilter === null) return slots;
		return slots.filter((s) =>
			s.claims.some(
				(c) => c.cca_id === ccaFilter && c.status !== "cancelled" && c.status !== "yielded",
			),
		);
	}, [slots, ccaFilter]);

	const daySlots = useMemo(() => {
		if (!selectedDate) return [];
		return filteredSlots.filter((s) => s.booked_date === selectedDate);
	}, [filteredSlots, selectedDate]);

	async function handleYield(claimId: number) {
		try {
			const res = await fetch(`/api/facilities/claims/${claimId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "yielded" }),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to yield");
				return;
			}
			toast.success("Yielded slot");
			fetchSlots();
		} catch {
			toast.error("Network error");
		}
	}

	async function handleRelease(claimId: number) {
		try {
			const res = await fetch(`/api/facilities/claims/${claimId}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to release");
				return;
			}
			toast.success("Booking released");
			fetchSlots();
		} catch {
			toast.error("Network error");
		}
	}

	if (chairCcas.length === 0) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="My CCA Bookings" />
				<EmptyState
					icon={Calendar}
					title="Not a CCA Chair"
					description="Only CCA chairs can view and manage bookings."
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="My CCA Bookings"
				description="View and manage your CCA's facility bookings"
			/>

			{chairCcas.length > 1 && (
				<div className="mb-4 flex flex-wrap gap-1.5">
					<button
						onClick={() => setCcaFilter(null)}
						className={cn(
							"rounded-full px-3 py-1 text-xs font-medium transition-colors",
							ccaFilter === null
								? "bg-primary text-primary-foreground"
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
								"rounded-full px-3 py-1 text-xs font-medium transition-colors",
								ccaFilter === cca.id
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{cca.name}
						</button>
					))}
				</div>
			)}

			<div className="flex flex-col gap-6 lg:flex-row">
				<div className="w-full lg:w-[320px] shrink-0">
					{loading ? (
						<Skeleton className="h-[320px] w-full rounded-lg" />
					) : (
						<MonthGrid
							year={year}
							month={month}
							selectedDate={selectedDate}
							slots={filteredSlots}
							onSelectDate={setSelectedDate}
							onChangeMonth={(y, m) => {
								setYear(y);
								setMonth(m);
							}}
						/>
					)}
				</div>

				<div className="flex-1 min-w-0">
					{loading ? (
						<div className="space-y-3">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : selectedDate ? (
						<div>
							<h3 className="mb-3 text-lg font-semibold">{formatDisplayDate(selectedDate)}</h3>
							{daySlots.length === 0 ? (
								<p className="text-sm text-muted-foreground">No bookings on this day.</p>
							) : (
								<div className="overflow-hidden rounded-lg border">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
												<th className="px-3 py-2">Venue</th>
												<th className="px-3 py-2">Time</th>
												<th className="px-3 py-2">Activity</th>
												<th className="px-3 py-2">Status</th>
												<th className="px-3 py-2 w-[1%]" />
											</tr>
										</thead>
										<tbody>
											{daySlots
												.sort((a, b) => a.time_from.localeCompare(b.time_from))
												.map((slot) => {
													const activeCcaIds = ccaFilter !== null ? [ccaFilter] : chairCcaIds;
													const myClaim = slot.claims.find(
														(c) =>
															activeCcaIds.includes(c.cca_id) &&
															c.status !== "cancelled" &&
															c.status !== "yielded",
													);
													if (!myClaim) return null;

													const statusConfig = CLAIM_STATUS_CONFIG[myClaim.status as ClaimStatus];
													const typeConfig = BOOKING_TYPE_CONFIG[slot.type];

													return (
														<tr
															key={slot.id}
															className="border-b last:border-0 hover:bg-accent/30 transition-colors"
														>
															<td className="px-3 py-2.5">
																<div className="font-medium">{slot.sub_venue}</div>
																{slot.venue !== slot.sub_venue && (
																	<div className="text-xs text-muted-foreground">{slot.venue}</div>
																)}
															</td>
															<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
																<span className="inline-flex items-center gap-1.5">
																	<span
																		className="h-2 w-2 rounded-full shrink-0"
																		style={{ backgroundColor: typeConfig.color }}
																	/>
																	{formatTime(slot.time_from)} – {formatTime(slot.time_to)}
																</span>
															</td>
															<td className="px-3 py-2.5">
																<div>{myClaim.activity}</div>
																<div className="text-xs text-muted-foreground">
																	{myClaim.cca_name}
																</div>
															</td>
															<td className="px-3 py-2.5">
																<Badge
																	variant="outline"
																	style={{
																		borderColor: statusConfig?.color,
																		color: statusConfig?.color,
																	}}
																>
																	{statusConfig?.label ?? myClaim.status}
																</Badge>
															</td>
															<td className="px-3 py-2.5 whitespace-nowrap">
																{myClaim.status === "conflicted" && (
																	<Button
																		size="sm"
																		variant="destructive"
																		className="h-7 text-xs"
																		onClick={() => handleYield(myClaim.id)}
																	>
																		Yield
																	</Button>
																)}
																{myClaim.status === "approved" && (
																	<Button
																		size="sm"
																		variant="outline"
																		className="h-7 text-xs"
																		onClick={() => handleRelease(myClaim.id)}
																	>
																		Release
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
					) : (
						<p className="text-sm text-muted-foreground">Select a day to view your bookings.</p>
					)}
				</div>
			</div>
		</div>
	);
}
