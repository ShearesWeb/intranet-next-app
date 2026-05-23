import { GuideFaq } from "@/features/holiday-subsidy/components/guide-faq";
import { GuidePhaseCards } from "@/features/holiday-subsidy/components/guide-phase-card";
import { GuideProcessOverview } from "@/features/holiday-subsidy/components/guide-process-overview";

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
