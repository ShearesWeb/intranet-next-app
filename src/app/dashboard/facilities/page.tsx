"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid } from "@/components/facilities/month-grid";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { VenueFilter } from "@/components/facilities/venue-filter";
import { TypeFilter } from "@/components/facilities/type-filter";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { MyCcaBookings } from "@/components/facilities/my-cca-bookings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCalendarMonth } from "@/hooks/use-calendar-month";
import { useChairCcas } from "@/hooks/use-chair-ccas";
import { SlotWithContext, FacilityType } from "@/types/facilities";
import { toast } from "sonner";

export default function FacilitiesPage() {
	const { year, month, selectedDate, setSelectedDate, changeMonth, monthRange } =
		useCalendarMonth();
	const [venueFilter, setVenueFilter] = useState<string[]>([]);
	const [typeFilter, setTypeFilter] = useState<FacilityType[]>([]);
	const [claimBooking, setClaimBooking] = useState<SlotWithContext | null>(null);

	const { chairCcas, isChair } = useChairCcas();

	const {
		data,
		loading,
		refetch: fetchBookings,
	} = useApiQuery<SlotWithContext[]>(
		`/api/facilities/slots?start=${monthRange.start}&end=${monthRange.end}`,
	);
	const bookings = useMemo(() => data ?? [], [data]);

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
		return filtered.filter((b) => b.date === selectedDate);
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
			<PageHeader
				title="Facilities"
				description={
					isChair
						? "Browse and claim venue slots for your CCA"
						: "Browse venue availability. Only CCA chairs can claim slots."
				}
			/>

			<Tabs defaultValue="book">
				{/* A lone tab reads as a dead control, so non-chairs get no tab bar. */}
				{isChair && (
					<TabsList>
						<TabsTrigger value="book">Book Facilities</TabsTrigger>
						<TabsTrigger value="my-bookings">My bookings</TabsTrigger>
					</TabsList>
				)}

				<TabsContent value="book" className="space-y-6">
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
								onChangeMonth={changeMonth}
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
								<p className="text-sm text-muted-foreground">
									Select a day to view available slots.
								</p>
							)}
						</div>
					</div>
				</TabsContent>

				{isChair && (
					<TabsContent value="my-bookings">
						<MyCcaBookings />
					</TabsContent>
				)}
			</Tabs>

			<ClaimDialog
				booking={claimBooking}
				chairCcas={chairCcas}
				onClose={() => setClaimBooking(null)}
				onSuccess={fetchBookings}
			/>
		</div>
	);
}
