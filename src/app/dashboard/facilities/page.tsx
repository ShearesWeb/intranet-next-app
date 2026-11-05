"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BookCalendar } from "@/components/facilities/book-calendar";
import { FacilityEmpty, FacilityTabs } from "@/components/facilities/facility-ui";
import { MyBookings } from "@/components/facilities/my-bookings";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { useFacilityBookingCcas } from "@/hooks/use-facility-booking-ccas";
import { useMyFacilityClaims } from "@/hooks/use-my-facility-claims";
import { useAuth } from "@/lib/auth/auth-context";
import { isBookableFacilityType, isHiddenFacility } from "@/lib/facilities/bookable-types";
import { groupClaimSegments } from "@/lib/facilities/booking-grid";
import { getBookingWeeks, getMondayOf, getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { Facility, SlotWithContext } from "@/types/facilities";

type BookTab = "book" | "mine";

export default function FacilitiesPage() {
	const { user } = useAuth();
	const { bookingCcas, canBook, ready } = useFacilityBookingCcas();
	const weeks = useMemo(() => getBookingWeeks(), []);
	const [tab, setTab] = useState<BookTab>("book");
	const [weekIndex, setWeekIndex] = useState(0);
	const [day, setDay] = useState(() => {
		const today = getSingaporeDateKey();
		return weeks[0]?.dates.includes(today) ? today : (weeks[0]?.start ?? today);
	});

	const week = weeks[weekIndex];
	// The calendar needs one week at a time; My bookings' notes need the whole window.
	const slotsUrl = useMemo(() => {
		if (!week) return "/api/facilities/slots";
		return tab === "mine"
			? `/api/facilities/slots?start=${weeks[0].start}&end=${weeks[weeks.length - 1].end}`
			: `/api/facilities/slots?start=${week.start}&end=${week.end}`;
	}, [tab, week, weeks]);

	const {
		data: slotData,
		loading: slotsLoading,
		refetch: refetchSlots,
	} = useApiQuery<SlotWithContext[]>(slotsUrl, {
		enabled: Boolean(week),
		initialData: [],
		toastOnError: true,
		errorMessage: "Failed to load the facilities calendar",
	});
	const { data: facilityData, loading: facilitiesLoading } = useApiQuery<Facility[]>(
		"/api/facilities/catalog",
		{ initialData: [] },
	);

	const bookingCcaIds = useMemo(() => bookingCcas.map((cca) => cca.id), [bookingCcas]);
	const {
		claims: myClaims,
		loading: claimsLoading,
		refetch: refetchClaims,
	} = useMyFacilityClaims(bookingCcaIds);

	// A refetch keeps the current grid on screen. Only the first load gets a skeleton.
	const hasLoaded = useRef(false);
	if (!slotsLoading && !facilitiesLoading) hasLoaded.current = true;

	const slots = useMemo(
		() => (slotData ?? []).filter((slot) => isBookableFacilityType(slot.type)),
		[slotData],
	);
	// Venues hidden from Book offer no slots, so they drop out of the columns here.
	const columns = useMemo(() => {
		const offered = new Set(slots.map((slot) => slot.facility_id));
		return (facilityData ?? []).filter(
			(facility) =>
				isBookableFacilityType(facility.type) &&
				!isHiddenFacility(facility) &&
				offered.has(facility.id),
		);
	}, [facilityData, slots]);

	const onChanged = useCallback(
		() => Promise.all([refetchSlots(), refetchClaims()]),
		[refetchSlots, refetchClaims],
	);

	const pendingCount = useMemo(() => {
		const from = getMondayOf(getSingaporeDateKey());
		return groupClaimSegments(
			myClaims.filter((claim) => claim.status === "pending" && claim.date >= from),
		).length;
	}, [myClaims]);

	const gridDates = useMemo(() => new Set(weeks.flatMap((option) => option.dates)), [weeks]);

	function viewOnGrid(date: string) {
		const index = weeks.findIndex((option) => option.dates.includes(date));
		if (index < 0) return;
		setWeekIndex(index);
		setDay(date);
		setTab("book");
	}

	const description =
		tab === "mine"
			? "Every venue request you've sent for your committee over the next 4 weeks. Open one to withdraw it or find it on the grid."
			: canBook
				? "Pick a time on the grid to request a venue for your committee. JCRC approves every request."
				: "See when Sheares venues are open. Only committee chairs and vice-chairs can request slots.";

	return (
		<div className="flex flex-col gap-5 p-4 md:p-6">
			<PageHeader title="Book Facilities" description={description} />

			{canBook && (
				<FacilityTabs
					tabs={[
						{ key: "book", label: "Calendar" },
						{ key: "mine", label: "My bookings", count: pendingCount },
					]}
					active={tab}
					onChange={setTab}
				/>
			)}

			{tab === "mine" && canBook ? (
				<MyBookings
					claims={myClaims}
					slots={slots}
					chairCcas={bookingCcas}
					loading={claimsLoading}
					gridDates={gridDates}
					onViewOnGrid={viewOnGrid}
					onChanged={onChanged}
				/>
			) : !week ? (
				<FacilityEmpty>Facility booking is unavailable outside NUS teaching weeks.</FacilityEmpty>
			) : !hasLoaded.current ? (
				<Skeleton className="h-[640px] w-full rounded-xl" />
			) : columns.length === 0 && !slotsLoading ? (
				<FacilityEmpty>No venues are open for booking this week.</FacilityEmpty>
			) : (
				<BookCalendar
					weeks={weeks}
					weekIndex={weekIndex}
					day={day}
					onWeekChange={setWeekIndex}
					onDayChange={setDay}
					facilities={columns}
					slots={slots}
					myClaims={myClaims}
					chairCcas={bookingCcas}
					isJcrc={Boolean(user?.is_jcrc)}
					userReady={ready}
					onChanged={onChanged}
				/>
			)}
		</div>
	);
}
