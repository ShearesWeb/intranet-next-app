"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid } from "@/components/facilities/month-grid";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { MyCcaBookings } from "@/components/facilities/my-cca-bookings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCalendarMonth } from "@/hooks/use-calendar-month";
import { useChairCcas } from "@/hooks/use-chair-ccas";
import { useAuth } from "@/lib/auth/auth-context";
import { SlotWithContext } from "@/types/facilities";
import { isReboksBookingEnabled } from "@/lib/feature-flags";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { toast } from "sonner";

export default function FacilitiesPage() {
	const { year, month, selectedDate, setSelectedDate, changeMonth, monthRange } =
		useCalendarMonth();
	const [claimBooking, setClaimBooking] = useState<SlotWithContext | null>(null);

	const { chairCcas, isChair } = useChairCcas();
	const { user } = useAuth();
	// JCRC sees every month's REBOKS slots, so the notice would only confuse them.
	// While REBOKS booking is parked, there is nothing to warn anyone about.
	const showHorizonNotice = isReboksBookingEnabled() && !user?.is_jcrc;

	const {
		data,
		loading,
		refetch: fetchBookings,
	} = useApiQuery<SlotWithContext[]>(
		`/api/facilities/slots?start=${monthRange.start}&end=${monthRange.end}`,
	);
	// The slots API still returns every venue type; while REBOKS booking is
	// parked the calendar simply never shows those slots, so nobody can claim one.
	const bookings = useMemo(
		() => (data ?? []).filter((b) => isBookableFacilityType(b.type)),
		[data],
	);

	const dayBookings = useMemo(() => {
		if (!selectedDate) return [];
		return bookings.filter((b) => b.date === selectedDate);
	}, [bookings, selectedDate]);

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
					<div className="flex flex-col gap-6 lg:flex-row">
						<div className="w-full lg:w-[320px] shrink-0">
							<MonthGrid
								year={year}
								month={month}
								selectedDate={selectedDate}
								bookings={bookings}
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
									showHorizonNotice={showHorizonNotice}
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
