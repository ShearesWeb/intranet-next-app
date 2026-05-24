import { AllocationFAQ } from "@/components/allocation/allocation-faq";
import { GaleShapleyVisual } from "@/components/allocation/gale-shapley-visual";
import { AllocationCapsVisual } from "@/components/allocation/allocation-caps-visual";
import { AlgorithmInfoCards } from "@/components/allocation/algorithm-info-cards";
import { PageHeader } from "@/components/layout/page-header";

export default function CCAAllocationGuide() {
	return (
		<div className="flex flex-col gap-10 p-4 md:p-6">
			<PageHeader title="CCA Allocation Guide" description="How the matching algorithm works, position caps, and FAQs." />
			<GaleShapleyVisual />
			<AllocationCapsVisual />
			<AlgorithmInfoCards />
			<AllocationFAQ />
		</div>
	);
}
