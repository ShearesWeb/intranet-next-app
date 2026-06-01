"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid } from "@/components/facilities/month-grid";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { VenueFilter } from "@/components/facilities/venue-filter";
import { TypeFilter } from "@/components/facilities/type-filter";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { FacilitySlotWithClaims, BookingType } from "@/types/facilities";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function getMonthRange(year: number, month: number) {
	const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

export default function FacilitiesPage() {
	const { user } = useAuth();
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());
	const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split("T")[0]);
	const [slots, setSlots] = useState<FacilitySlotWithClaims[]>([]);
	const [loading, setLoading] = useState(true);
	const [venueFilter, setVenueFilter] = useState<string[]>([]);
	const [typeFilter, setTypeFilter] = useState<BookingType[]>([]);
	const [claimSlot, setClaimSlot] = useState<FacilitySlotWithClaims | null>(null);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const isChair = chairCcas.length > 0;

	const fetchSlots = useCallback(async () => {
		const { start, end } = getMonthRange(year, month);
		setLoading(true);
		try {
			const res = await fetch(`/api/facilities/slots?start=${start}&end=${end}`);
			const json = await res.json();
			if (res.ok) {
				setSlots(json.data ?? []);
			}
		} catch {
			// fetch failed
		} finally {
			setLoading(false);
		}
	}, [year, month]);

	useEffect(() => {
		fetchSlots();
	}, [fetchSlots]);

	const allVenues = useMemo(() => {
		const set = new Set<string>();
		for (const s of slots) set.add(s.sub_venue);
		return [...set].sort();
	}, [slots]);

	const filteredSlots = useMemo(() => {
		return slots.filter((s) => {
			if (venueFilter.length > 0 && !venueFilter.includes(s.sub_venue)) return false;
			if (typeFilter.length > 0 && !typeFilter.includes(s.type)) return false;
			return true;
		});
	}, [slots, venueFilter, typeFilter]);

	const daySlots = useMemo(() => {
		if (!selectedDate) return [];
		return filteredSlots.filter((s) => s.booked_date === selectedDate);
	}, [filteredSlots, selectedDate]);

	function handleChangeMonth(y: number, m: number) {
		setYear(y);
		setMonth(m);
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

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader title="Facilities" description="Browse and claim venue slots for your CCA" />

			<div className="flex flex-wrap items-center gap-3">
				<VenueFilter venues={allVenues} selected={venueFilter} onChange={setVenueFilter} />
				<TypeFilter selected={typeFilter} onChange={setTypeFilter} />
			</div>

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
							onChangeMonth={handleChangeMonth}
						/>
					)}
				</div>

				<div className="flex-1 min-w-0">
					{loading ? (
						<div className="space-y-3">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : selectedDate ? (
						<DayDetailPanel
							date={selectedDate}
							slots={daySlots}
							isChair={isChair}
							onClaim={setClaimSlot}
							onRelease={handleRelease}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Select a day to view available slots.</p>
					)}
				</div>
			</div>

			<ClaimDialog
				slot={claimSlot}
				chairCcas={chairCcas}
				onClose={() => setClaimSlot(null)}
				onSuccess={fetchSlots}
			/>
		</div>
	);
}
