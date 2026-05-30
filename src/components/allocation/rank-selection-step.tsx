"use client";

import React from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { rankingColumns } from "@/components/allocation/ranking-columns";
import type { RankablePosition } from "@/types/preferences";

interface RankSelectionStepProps {
	allPositions: RankablePosition[];
	selectedIds: Set<number>;
	onToggle: (positionId: number) => void;
	onProceed: () => void;
}

export function RankSelectionStep({
	allPositions,
	selectedIds,
	onToggle,
	onProceed,
}: RankSelectionStepProps) {
	const count = selectedIds.size;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">Indicate your CCA preferences</h1>
				<p className="text-muted-foreground">
					Tick every position you&apos;d genuinely consider joining. You&apos;ll order them by
					preference in the next step. Positions that are already full are hidden automatically.
				</p>
			</div>

			<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
				<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
				<div className="text-amber-900">
					<span className="font-semibold">Pick generously.</span> The more positions you select, the
					better the algorithm can match you. Picking only one or two is the most common reason
					students end up unmatched.
				</div>
			</div>

			<div className="flex items-center justify-between gap-3">
				<div className="text-sm text-muted-foreground">
					{count === 0
						? "No preferences selected"
						: `${count} preference${count === 1 ? "" : "s"} selected`}
				</div>
				<Button onClick={onProceed} disabled={count === 0}>
					Next: Order your preferences →
				</Button>
			</div>

			<DataTable
				data={allPositions}
				columns={rankingColumns}
				searchColumn="cca_name"
				searchPlaceholder="Search by position or CCA..."
				pageSize={20}
				emptyMessage="No positions match your search."
				selectable
				selectedIds={selectedIds}
				onSelectionChange={onToggle}
			/>
		</div>
	);
}
