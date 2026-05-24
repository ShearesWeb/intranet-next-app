import { GuideFaq } from "@/components/holiday-subsidy/guide-faq";
import { GuidePhaseCards } from "@/components/holiday-subsidy/guide-phase-card";
import { GuideProcessOverview } from "@/components/holiday-subsidy/guide-process-overview";

export default function Guide() {
	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">Holiday Subsidy Guide</h1>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Full process, requirements, and FAQs for the holiday subsidy system.
				</p>
			</div>
			<GuideProcessOverview />
			<GuidePhaseCards />
			<GuideFaq />
		</div>
	);
}
