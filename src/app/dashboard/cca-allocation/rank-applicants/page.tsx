"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useApplicantRankings } from "@/hooks/use-applicant-rankings";
import { PositionCard } from "@/components/allocation/position-card";
import type { Position } from "@/types/applicants";

export default function RankApplicants() {
	const { user } = useAuth();
	const {
		positions,
		loading,
		isSaving,
		hasChanges,
		hasAnyChanges,
		mounted,
		handleAddApplicant,
		handleRemoveApplicant,
		handleReorderApplicants,
		handleSaveAll,
	} = useApplicantRankings(user?.email);

	if (!mounted || !user) return <LoadingSpinner message="Loading..." />;

	if (loading) {
		return <LoadingSpinner message="Loading CCA positions and applicants..." />;
	}

	const saveButton =
		positions.length > 0 ? (
			<Button onClick={handleSaveAll} disabled={isSaving || !hasAnyChanges}>
				{isSaving ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Saving...
					</>
				) : (
					"Save preferences"
				)}
			</Button>
		) : undefined;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Rank your applicant preferences"
				description="Add applicants for each position, then arrange them in order of preference. Changes across all positions are saved together."
				actions={saveButton}
			/>

			{hasAnyChanges && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
					<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
						You have unsaved changes. Don&apos;t forget to save your preferences!
					</p>
				</div>
			)}

			{positions.length === 0 ? (
				<EmptyState
					title="No CCA positions to manage."
					description="You are not listed as chair, head, or vice for any CCA. If you believe this is a mistake, contact your CCA administrator."
				/>
			) : (
				<div className="flex flex-col divide-y divide-border">
					{positions.map((pos: Position) => (
						<div key={pos.id} className="py-8 first:pt-0 last:pb-0">
							<PositionCard
								position={pos}
								hasChanges={hasChanges[pos.id] || false}
								onAddApplicant={(userData) => handleAddApplicant(pos.id, userData)}
								onRemoveApplicant={(userId) => handleRemoveApplicant(pos.id, userId)}
								onReorderApplicants={(newApplicants) =>
									handleReorderApplicants(pos.id, newApplicants)
								}
							/>
						</div>
					))}
				</div>
			)}

			{isSaving && <LoadingSpinner message="Saving preferences..." overlay />}
		</div>
	);
}
