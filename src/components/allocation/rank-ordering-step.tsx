"use client";

import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { OrderingTable } from "@/components/table/ordering-table";
import { rankingOrderingColumns } from "@/components/allocation/ranking-columns";
import { PreferenceCapMeter } from "@/components/allocation/preference-cap-meter";
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
	const [justSaved, setJustSaved] = React.useState(false);
	const wasSaving = React.useRef(false);

	React.useEffect(() => {
		const finishedSaving = wasSaving.current && !isSaving && !hasChanges;
		wasSaving.current = isSaving;
		if (finishedSaving) {
			setJustSaved(true);
			const timer = window.setTimeout(() => setJustSaved(false), 1500);
			return () => window.clearTimeout(timer);
		}
	}, [isSaving, hasChanges]);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Rank your CCA preferences"
				description="Drag rows to reorder. Your top preference should be #1."
				actions={
					<>
						<Button variant="outline" size="sm" className="group gap-2" onClick={onBack}>
							<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
							Back to preferences
						</Button>
						<Button
							onClick={onSave}
							disabled={!hasChanges}
							isLoading={isSaving}
							loadingText="Saving…"
						>
							{justSaved ? (
								<>
									<Check className="h-4 w-4" />
									Saved
								</>
							) : (
								"Save preferences"
							)}
						</Button>
					</>
				}
			/>

			<div className="max-w-xl rounded-xl border p-4">
				<PreferenceCapMeter selectedCount={selectedPositions.length} />
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
				columns={rankingOrderingColumns}
				onReorder={onReorder}
				showRankColumn={true}
				emptyMessage="No positions selected."
			/>
		</div>
	);
}
