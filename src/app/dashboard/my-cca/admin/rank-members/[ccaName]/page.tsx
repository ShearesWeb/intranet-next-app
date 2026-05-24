"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";

import { PositionRankingCard } from "@/components/ranking/position-ranking-card";
import { useRankingEditor } from "@/hooks/use-ranking-editor";
import { useAuth } from "@/lib/auth/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";

export default function CCARankingPage() {
	const { user } = useAuth();
	const searchParams = useSearchParams();
	const ccaId = searchParams.get("ccaId");
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

	if (!user) return <LoadingSpinner message="Loading..." />;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Chair / Maincomm Ranking"
				backHref="/dashboard/my-cca/admin"
				backLabel="Back to my CCAs"
				actions={
					<Button onClick={() => void handleSave()} disabled={isSaving || !hasChanges} size="sm">
						{isSaving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="mr-2 h-4 w-4" />
								Save Rankings
							</>
						)}
					</Button>
				}
			/>

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
				<div className="flex justify-center py-8">
					<LoadingSpinner />
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Unable to load rankings</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : positionGroups.length > 0 ? (
				<div className="space-y-6">
					{positionGroups.map((group) => (
						<PositionRankingCard
							key={group.position_id}
							group={group}
							ccaType={ccaType}
							onFieldChange={handleFieldChange}
						/>
					))}
					<div className="text-sm text-muted-foreground">
						Ranking updates automatically based on score.
					</div>
				</div>
			) : (
				<Card className="border-dashed bg-muted/40">
					<CardContent className="py-12 text-center text-muted-foreground">
						No members found
					</CardContent>
				</Card>
			)}
		</div>
	);
}
