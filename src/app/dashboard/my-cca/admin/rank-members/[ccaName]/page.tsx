"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, Save } from "lucide-react";

import { PositionRankingCard } from "@/components/ranking/position-ranking-card";
import { useRankingEditor } from "@/hooks/use-ranking-editor";
import { useAuth } from "@/lib/auth/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DashedEmpty } from "@/components/shared/inline-states";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";

export default function CCARankingPage() {
	const { user } = useAuth();
	const params = useParams();
	const searchParams = useSearchParams();
	const ccaId = searchParams.get("ccaId");
	const ccaNameParam = params?.ccaName;
	const ccaName = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";
	const {
		isLoading,
		isSaving,
		error,
		positionGroups,
		unrankedCount,
		hasChanges,
		ccaType,
		handleFieldChange,
		handleSave,
	} = useRankingEditor(ccaId);

	if (!user) return <DashboardTableSkeleton rows={5} cols={5} />;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title={ccaName ? `Rank Members · ${ccaName}` : "Rank Members"}
				description="Score each member and the rank order updates automatically."
				backHref="/dashboard/my-cca/admin"
				backLabel="Back to CCA Ranking"
				actions={
					<Button
						onClick={() => void handleSave()}
						disabled={!hasChanges}
						size="sm"
						isLoading={isSaving}
						loadingText="Saving…"
					>
						<Save className="mr-2 h-4 w-4" />
						Save Rankings
					</Button>
				}
			/>

			{hasChanges && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
					<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
						You have unsaved ranking changes. Don&apos;t forget to save!
					</p>
				</div>
			)}

			{unrankedCount > 0 && (
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Pending Rankings</AlertTitle>
					<AlertDescription>
						You have {unrankedCount} member{unrankedCount !== 1 ? "s" : ""} left to rank. Complete
						the required score inputs for each member to finalize the order.
					</AlertDescription>
				</Alert>
			)}

			{isLoading ? (
				<DashboardTableSkeleton rows={5} cols={5} className="p-0" />
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Unable to load rankings</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : positionGroups.length > 0 ? (
				<div className="flex flex-col divide-y divide-border">
					{positionGroups.map((group) => (
						<div key={group.position_id} className="py-8 first:pt-0 last:pb-0">
							<PositionRankingCard
								group={group}
								ccaType={ccaType}
								onFieldChange={handleFieldChange}
							/>
						</div>
					))}
				</div>
			) : (
				<DashedEmpty className="p-12">No members found</DashedEmpty>
			)}
		</div>
	);
}
