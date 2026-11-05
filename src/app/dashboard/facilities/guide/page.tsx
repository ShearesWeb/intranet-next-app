import { PageHeader } from "@/components/layout/page-header";

const STEP_1_BODY =
	"JCRC places facility bookings — one venue, one date, one hour. Venues are added by JCRC and can repeat weekly, with an optional start and end date.";

const STEPS: { title: string; body: string }[] = [
	{
		title: "1. Bookings are published",
		body: STEP_1_BODY,
	},
	{
		title: "2. Committees claim a slot",
		body: "Committee chairs and vice-chairs pick a time on the calendar and request it for their committee, up to 4 weeks ahead during the NUS semester, including recess week, reading week and exams. JCRC books the same way, under Sheares Hall. One request → the time goes Pending. If two or more committees ask for overlapping hours, it becomes a Conflict.",
	},
	{
		title: "3. JCRC approves every booking",
		body: "Every request needs JCRC approval on the Requests tab — including uncontested ones. For conflicts, JCRC picks the winning committee. Approved slots become Confirmed; the others are released.",
	},
	{
		title: "4. Cancelling",
		body: "Chairs and vice-chairs can withdraw their committee's claim at any time, whatever its status. JCRC can revoke any confirmed booking, which reopens the slot.",
	},
];

export default function FacilitiesGuidePage() {
	return (
		<div className="flex flex-col gap-8 p-4 md:p-6">
			<PageHeader
				title="Facilities Booking Guide"
				description="How venue booking works, claims, and conflict resolution."
			/>
			<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
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
