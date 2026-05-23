// src/app/dashboard/cca-allocation/rank/page.tsx
"use client";

import React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRankablePositions } from "@/features/allocation/hooks/use-rankable-positions";
import { RankSelectionStep } from "@/features/allocation/components/rank-selection-step";
import { RankOrderingStep } from "@/features/allocation/components/rank-ordering-step";

export default function RankCCA() {
	const { user } = useAuth();
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
	} = useRankablePositions(user?.email);

	if (loading) {
		return <LoadingSpinner message="Loading your CCA preferences..." />;
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
