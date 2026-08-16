// src/app/dashboard/cca-allocation/rank/page.tsx
"use client";

import React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";
import { DashedEmpty } from "@/components/shared/inline-states";
import { useRankablePositions } from "@/hooks/use-rankable-positions";
import { RankSelectionStep } from "@/components/allocation/rank-selection-step";
import { RankOrderingStep } from "@/components/allocation/rank-ordering-step";
import { RankingPeriodBanner } from "@/components/allocation/ranking-period-banner";
import { useRankingPeriods } from "@/lib/timed-flags/ranking-periods-context";

function RankWizard({ userEmail }: { userEmail: string | undefined }) {
	const {
		allPositions,
		selectedPositions,
		loading,
		isSaving,
		currentStep,
		selectedIds,
		hasChanges,
		togglePositionSelection,
		proceedToRanking,
		backToSelection,
		handleReorder,
		saveRankings,
	} = useRankablePositions(userEmail);

	if (loading) {
		return <DashboardTableSkeleton rows={8} cols={4} />;
	}

	if (currentStep === "selection") {
		return (
			<RankSelectionStep
				allPositions={allPositions}
				selectedIds={selectedIds}
				onToggle={togglePositionSelection}
				onProceed={proceedToRanking}
			/>
		);
	}

	return (
		<RankOrderingStep
			selectedPositions={selectedPositions}
			isSaving={isSaving}
			hasChanges={hasChanges}
			onBack={backToSelection}
			onReorder={handleReorder}
			onSave={saveRankings}
		/>
	);
}

export default function RankCCA() {
	const { user } = useAuth();
	const { periods, openTypes, anyOpen, loading: periodsLoading } = useRankingPeriods();

	if (periodsLoading || periods === null) {
		return <DashboardTableSkeleton rows={8} cols={4} />;
	}

	if (!anyOpen) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader
					title="Indicate your CCA preferences"
					description="Preferences can only be submitted while a ranking period is open."
				/>
				<RankingPeriodBanner periods={periods} />
				<DashedEmpty className="p-8">
					Preference submissions are closed right now. Check the periods above for when they open.
				</DashedEmpty>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="px-4 pt-4 md:px-6 md:pt-6">
				<RankingPeriodBanner periods={periods} />
			</div>
			{/* Keyed by the open-type set: when a period opens or closes mid-session
			    the wizard remounts and refetches, so stale positions can't be saved. */}
			<RankWizard key={openTypes.join(",")} userEmail={user?.email} />
		</div>
	);
}
