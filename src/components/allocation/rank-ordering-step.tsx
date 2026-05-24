"use client";

import React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderingTable } from "@/components/table/ordering-table";
import { rankingColumns } from "@/components/allocation/ranking-columns";
import type { RankablePosition } from "@/types/preferences";

interface RankOrderingStepProps {
	selectedPositions: RankablePosition[];
	isSaving: boolean;
	hasChanges: boolean;
	onBack: () => void;
	onReorder: (newData: RankablePosition[]) => void;
	onSave: () => void;
}

export function RankOrderingStep({
	selectedPositions,
	isSaving,
	hasChanges,
	onBack,
	onReorder,
	onSave,
}: RankOrderingStepProps) {
	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold">Rank your CCA preferences</h1>
					<p className="text-muted-foreground text-sm">
						Drag rows to reorder. Your top preference should be #1.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={onBack}>
						<ArrowLeft className="h-4 w-4" />
						Back to preferences
					</Button>
					<Button onClick={onSave} disabled={isSaving || !hasChanges}>
						{isSaving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save preferences"
						)}
					</Button>
				</div>
			</div>

			{hasChanges && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
					<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
						You have unsaved changes. Don&apos;t forget to save your preferences!
					</p>
				</div>
			)}

			<OrderingTable
				data={selectedPositions}
				columns={rankingColumns}
				onReorder={onReorder}
				showRankColumn={true}
				emptyMessage="No positions selected."
			/>
		</div>
	);
}
