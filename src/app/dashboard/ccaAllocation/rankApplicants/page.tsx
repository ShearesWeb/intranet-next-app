"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useApplicantRankings } from "@/features/allocation/hooks/use-applicant-rankings";
import { PositionCard } from "@/features/allocation/components/position-card";
import type { Position } from "@/features/allocation/types/applicants";

export default function RankApplicants() {
	const { user } = useAuth();
	const {
		positions,
		loading,
		isSaving,
		hasChanges,
		mounted,
		handleAddApplicant,
		handleRemoveApplicant,
		handleMoveApplicant,
		handleSaveRankings,
	} = useApplicantRankings(user?.email);

	if (!mounted || !user) return <LoadingSpinner message="Loading..." />;

	if (loading) {
		return <LoadingSpinner message="Loading CCA positions and applicants..." />;
	}

	return (
		<>
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<Card className="border-none shadow-lg">
					<CardHeader>
						<CardTitle className="text-3xl md:text-4xl">Rank Applicants for Your CCA</CardTitle>
						<p className="text-muted-foreground mt-2">
							Search and add applicants, then arrange them in order of preference. Changes are saved
							only when you click the &quot;Save Rankings&quot; button.
						</p>
					</CardHeader>
				</Card>

				{positions.length === 0 ? (
					<Card className="border-none shadow-lg">
						<CardContent className="pt-6 text-center">
							<p className="text-muted-foreground mb-2">
								You do not have any CCA positions to manage as chair/head/vice.
							</p>
							<p className="text-sm text-muted-foreground">
								Check your database chair appointments or try switching users.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-6">
						{positions.map((pos: Position, posIdx: number) => (
							<PositionCard
								key={pos.id}
								position={pos}
								positionIndex={posIdx}
								saving={isSaving}
								hasChanges={hasChanges[pos.id] || false}
								onAddApplicant={(userData) => handleAddApplicant(pos.id, userData)}
								onRemoveApplicant={(userId) => handleRemoveApplicant(pos.id, userId)}
								onMoveApplicant={(appIdx, delta) => handleMoveApplicant(posIdx, appIdx, delta)}
								onSaveRankings={() => handleSaveRankings(pos)}
							/>
						))}
					</div>
				)}
			</div>

			{isSaving && <LoadingSpinner message="Saving rankings..." overlay />}
		</>
	);
}
