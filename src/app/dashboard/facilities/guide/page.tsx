import { PageHeader } from "@/components/layout/page-header";

const STEPS: { title: string; body: string }[] = [
	{
		title: "1. Bookings are published",
		body: "JCRC places facility bookings — one venue, one date, one hour. Reboks slots come from the Reboks bot; other venues are added by JCRC and can repeat weekly, with an optional start and end date.",
	},
	{
		title: "2. CCAs claim a slot",
		body: "Chairs claim an available booking for their CCA at least 3 days before the slot date — closer than that, the day is locked. One claim → the slot goes Pending. If two or more CCAs claim the same slot, it becomes a Conflict.",
	},
	{
		title: "3. JCRC approves every booking",
		body: "Every claim needs JCRC approval on the Approvals page — including uncontested ones. For conflicts, JCRC picks the winning CCA. Approved slots become Confirmed; the others are released.",
	},
	{
		title: "4. Cancelling",
		body: "Chairs can withdraw their own claim at any time, whatever its status. JCRC can revoke any confirmed booking, which reopens the slot.",
	},
];

export default function FacilitiesGuidePage() {
	return (
		<div className="flex flex-col gap-8 p-4 md:p-6">
			<PageHeader
				title="Facilities Booking Guide"
				description="How venue booking works, claims, and conflict resolution."
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				{STEPS.map((s) => (
					<div key={s.title} className="rounded-lg border p-4">
						<h3 className="font-semibold">{s.title}</h3>
						<p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
					</div>
				))}
			</div>
		</div>
	);
}
