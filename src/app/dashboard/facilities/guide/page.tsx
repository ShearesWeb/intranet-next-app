import { BookingFlowVisual } from "@/components/facilities/booking-flow-visual";
import { PageHeader } from "@/components/layout/page-header";

export default function FacilitiesGuidePage() {
	return (
		<div className="flex flex-col gap-10 p-4 md:p-6">
			<PageHeader
				title="Facilities Booking Guide"
				description="How venue booking works, conflict resolution, and the claim process."
			/>
			<BookingFlowVisual />
		</div>
	);
}
