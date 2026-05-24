import { SubsidyFlowVisual } from "@/components/holiday-subsidy/subsidy-flow-visual";
import { PageHeader } from "@/components/layout/page-header";

export default function Guide() {
	return (
		<div className="flex flex-col gap-10 p-4 md:p-6">
			<PageHeader title="Holiday Subsidy Guide" description="Full process, requirements, and FAQs for the holiday subsidy system." />
			<SubsidyFlowVisual />
		</div>
	);
}
