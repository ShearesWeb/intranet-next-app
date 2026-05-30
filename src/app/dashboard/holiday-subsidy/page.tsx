import { SubsidyFlowVisual } from "@/components/holiday-subsidy/subsidy-flow-visual";
import { PageHeader } from "@/components/layout/page-header";

export default function HolidaySubsidyPage() {
	return (
		<div className="flex flex-col gap-10 p-4 md:p-6">
			<PageHeader
				title="Holiday Subsidy Guide"
				description="How the subsidy process works, requirements, and FAQs."
			/>
			<SubsidyFlowVisual />
		</div>
	);
}
