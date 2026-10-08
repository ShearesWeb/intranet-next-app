"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CurrentWeekBar } from "@/components/facilities/current-week-bar";
import { VenueCardGrid } from "@/components/facilities/venue-card-grid";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { MyCcaBookings } from "@/components/facilities/my-cca-bookings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { useChairCcas } from "@/hooks/use-chair-ccas";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { getCurrentNusWeek, getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { Facility, SlotWithContext } from "@/types/facilities";

export default function FacilitiesPage() {
	const week = useMemo(() => getCurrentNusWeek(), []);
	const [selectedDate, setSelectedDate] = useState(() => getSingaporeDateKey());
	const [claimBooking, setClaimBooking] = useState<SlotWithContext | null>(null);

	const { chairCcas, isChair } = useChairCcas();

	const slotsUrl = week
		? `/api/facilities/slots?start=${week.start}&end=${week.end}`
		: "/api/facilities/slots";

	const {
		data,
		loading,
		refetch: fetchBookings,
	} = useApiQuery<SlotWithContext[]>(slotsUrl, {
		enabled: Boolean(week),
		initialData: [],
	});
	const { data: facilityData, loading: facilitiesLoading } = useApiQuery<Facility[]>(
		"/api/facilities/catalog",
		{ initialData: [] },
	);

	const bookings = useMemo(
		() => (data ?? []).filter((booking) => isBookableFacilityType(booking.type)),
		[data],
	);
	const facilities = useMemo(
		() => (facilityData ?? []).filter((facility) => isBookableFacilityType(facility.type)),
		[facilityData],
	);

	const dayBookings = useMemo(
		() => bookings.filter((booking) => booking.date === selectedDate),
		[bookings, selectedDate],
	);

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
				{isChair && (
					<TabsList>
						<TabsTrigger value="book">Book Facilities</TabsTrigger>
						<TabsTrigger value="my-bookings">My bookings</TabsTrigger>
					</TabsList>
				)}

				<TabsContent value="book" className="space-y-4">
					{week ? (
						<>
							<CurrentWeekBar
								weekNumber={week.weekNumber}
								dates={week.dates}
								selectedDate={selectedDate}
								onSelectDate={setSelectedDate}
							/>

							<VenueCardGrid
								date={selectedDate}
								facilities={facilities}
								slots={dayBookings}
								isChair={isChair}
								loading={loading || facilitiesLoading}
								onClaim={setClaimBooking}
							/>
						</>
					) : (
						<div className="rounded-lg border p-6 text-sm text-muted-foreground">
							Facility booking is unavailable outside NUS teaching weeks.
						</div>
					)}
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
