"use client";

import { useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Facility, SlotWithContext } from "@/types/facilities";
import { getSingaporeDateKey } from "@/lib/nus-academic-calendar";

interface VenueCardGridProps {
	date: string;
	facilities: Facility[];
	slots: SlotWithContext[];
	isChair: boolean;
	loading?: boolean;
	onClaim: (slot: SlotWithContext) => void;
}

export function compactHourRange(hour: number): string {
	const endHour = (hour + 1) % 24;
	const startNumber = hour % 12 || 12;
	const endNumber = endHour % 12 || 12;
	const startPeriod = hour >= 12 ? "PM" : "AM";
	const endPeriod = endHour >= 12 ? "PM" : "AM";

	if (startPeriod === endPeriod) {
		return `${startNumber}–${endNumber} ${endPeriod}`;
	}
	if (endHour === 12) {
		return `${startNumber}–${endNumber} PM`;
	}

	return `${startNumber} ${startPeriod}–${endNumber} ${endPeriod}`;
}

export function VenueCardGrid({
	date,
	facilities,
	slots,
	isChair,
	loading = false,
	onClaim,
}: VenueCardGridProps) {
	const slotsByFacility = useMemo(() => {
		const grouped = new Map<number, SlotWithContext[]>();

		for (const slot of slots) {
			if (slot.status !== "available" && slot.status !== "confirmed") continue;

			const facilitySlots = grouped.get(slot.facility_id) ?? [];
			facilitySlots.push(slot);
			grouped.set(slot.facility_id, facilitySlots);
		}

		for (const facilitySlots of grouped.values()) {
			facilitySlots.sort((a, b) => a.hour - b.hour);
		}

		return grouped;
	}, [slots]);

	if (loading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
						<Skeleton className="aspect-[16/7] w-full rounded-lg" />
						<Skeleton className="mt-3 h-6 w-2/3" />
						<div className="mt-3 grid grid-cols-3 gap-2">
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
						</div>
					</div>
				))}
			</div>
		);
	}
	const isPastDate = date < getSingaporeDateKey();

	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{facilities.map((facility) => {
				const visibleSlots = slotsByFacility.get(facility.id) ?? [];
				const facilityName = facility.sub_venue || facility.venue;

				return (
					<article
						key={facility.id}
						className="overflow-hidden rounded-xl border bg-card p-3 shadow-sm"
					>
						<div className="flex aspect-[16/7] items-center justify-center rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/70">
							<ImageIcon aria-hidden="true" className="h-12 w-12 text-orange-300" />
						</div>

						<h2 className="mt-3 text-lg font-semibold">{facilityName}</h2>

						<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
							{visibleSlots.map((slot) => {
								const time = compactHourRange(slot.hour);
								if (slot.status === "confirmed") {
									const ccaName =
										slot.claims.find((claim) => claim.status === "approved")?.cca_name ?? "Booked";

									return (
										<div
											key={`${slot.facility_id}:${slot.date}:${slot.hour}`}
											aria-label={`${time} booked by ${ccaName}`}
											title={`Booked by ${ccaName}`}
											className="flex min-h-12 min-w-0 flex-col items-center justify-center rounded-full border border-red-600 bg-red-600 px-2 py-2 text-center text-white"
										>
											<span className="text-sm font-semibold leading-none tabular-nums">
												{time}
											</span>
											<span className="mt-1 max-w-full truncate text-[10px] font-medium leading-none">
												{ccaName}
											</span>
										</div>
									);
								}

								return (
									<button
										key={`${slot.facility_id}:${slot.date}:${slot.hour}`}
										type="button"
										disabled={!isChair || isPastDate}
										onClick={() => onClaim(slot)}
										title={
											!isChair
												? "Only CCA chairs can claim facility slots"
												: isPastDate
													? "Past dates cannot be booked"
													: `Claim ${time}`
										}
										className={cn(
											"min-h-12 rounded-full border border-green-600 bg-green-600 px-2 py-2",
											"text-sm font-semibold tabular-nums text-white",
											"transition-colors hover:border-green-700 hover:bg-green-700",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40",
											"disabled:cursor-not-allowed disabled:opacity-50",
										)}
									>
										{time}
									</button>
								);
							})}
						</div>
					</article>
				);
			})}
		</div>
	);
}
