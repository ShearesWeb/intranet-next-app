"use client";

import React from "react";
import { AllocationGuideHero } from "@/features/allocation/components/allocation-guide-hero";
import { AllocationTips } from "@/features/allocation/components/allocation-tips";
import { AllocationAlgorithmSteps } from "@/features/allocation/components/allocation-algorithm-steps";
import { AllocationFAQ } from "@/features/allocation/components/allocation-faq";

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
