import { AllocationGuideHero } from "@/components/allocation/allocation-guide-hero";
import { AllocationTips } from "@/components/allocation/allocation-tips";
import { AllocationAlgorithmSteps } from "@/components/allocation/allocation-algorithm-steps";
import { AllocationFAQ } from "@/components/allocation/allocation-faq";

export default function CCAAllocationGuide() {
	return (
		<div className="mx-auto flex max-w-5xl flex-col space-y-8 p-4 md:p-6">
			<AllocationGuideHero />
			<AllocationTips />
			<AllocationAlgorithmSteps />
			<AllocationFAQ />
		</div>
	);
}
