"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid } from "@/components/facilities/month-grid";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { VenueFilter } from "@/components/facilities/venue-filter";
import { TypeFilter } from "@/components/facilities/type-filter";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { MyCcaBookings } from "@/components/facilities/my-cca-bookings";
import { BookingWithClaims, FacilityType } from "@/types/facilities";
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
	const [bookings, setBookings] = useState<BookingWithClaims[]>([]);
	const [loading, setLoading] = useState(true);
	const [venueFilter, setVenueFilter] = useState<string[]>([]);
	const [typeFilter, setTypeFilter] = useState<FacilityType[]>([]);
	const [claimBooking, setClaimBooking] = useState<BookingWithClaims | null>(null);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const isChair = chairCcas.length > 0;

	const fetchBookings = useCallback(async () => {
		const { start, end } = getMonthRange(year, month);
		setLoading(true);
		try {
			const res = await fetch(`/api/facilities/bookings?start=${start}&end=${end}`);
			const json = await res.json();
			if (res.ok) setBookings(json.data ?? []);
		} catch {
			// fetch failed
		} finally {
			setLoading(false);
		}
	}, [year, month]);

	useEffect(() => {
		fetchBookings();
	}, [fetchBookings]);

	const allVenues = useMemo(() => {
		const set = new Set<string>();
		for (const b of bookings) set.add(b.sub_venue);
		return [...set].sort();
	}, [bookings]);

	const filtered = useMemo(() => {
		return bookings.filter((b) => {
			if (venueFilter.length > 0 && !venueFilter.includes(b.sub_venue)) return false;
			if (typeFilter.length > 0 && !typeFilter.includes(b.type)) return false;
			return true;
		});
	}, [bookings, venueFilter, typeFilter]);

	const dayBookings = useMemo(() => {
		if (!selectedDate) return [];
		return filtered.filter((b) => b.booked_date === selectedDate);
	}, [filtered, selectedDate]);

	async function handleWithdraw(claimId: number) {
		try {
			const res = await fetch(`/api/facilities/claims/${claimId}`, { method: "DELETE" });
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to withdraw");
				return;
			}
			toast.success("Claim withdrawn");
			fetchBookings();
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
					<MonthGrid
						year={year}
						month={month}
						selectedDate={selectedDate}
						bookings={filtered}
						onSelectDate={setSelectedDate}
						onChangeMonth={(y, m) => {
							setYear(y);
							setMonth(m);
						}}
					/>
				</div>

				<div className="flex-1 min-w-0">
					{selectedDate ? (
						<DayDetailPanel
							date={selectedDate}
							bookings={dayBookings}
							isChair={isChair}
							loading={loading}
							onClaim={setClaimBooking}
							onWithdraw={handleWithdraw}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Select a day to view available slots.</p>
					)}
				</div>
			</div>

			{isChair && (
				<div className="border-t pt-6">
					<MyCcaBookings />
				</div>
			)}

			<ClaimDialog
				booking={claimBooking}
				chairCcas={chairCcas}
				onClose={() => setClaimBooking(null)}
				onSuccess={fetchBookings}
			/>
		</div>
	);
}
