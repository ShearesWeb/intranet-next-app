"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Save } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { AppLoading } from "@/components/layout/app-loading";
import { PositionRankingCard } from "@/features/ranking/components/position-ranking-card";
import { useRankingEditor } from "@/features/ranking/hooks/use-ranking-editor";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function CCARankingPage() {
	const { user } = useAuth();
	const searchParams = useSearchParams();
	const ccaId = searchParams.get("ccaId");
	const { isLoading, isSaving, error, positionGroups, unrankedCount, hasChanges, ccaType, handleFieldChange, handleSave } = useRankingEditor(ccaId);

	if (!user) return <AppLoading />;

	return (
		<AppLayout>
			<div className="flex flex-col space-y-4 p-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<h1 className="text-2xl font-semibold">Chair / Maincomm Ranking</h1>
					<div className="flex flex-wrap items-center gap-4">
						<Button
							onClick={() => void handleSave()}
							disabled={isSaving || !hasChanges}
							size="lg"
							className="bg-green-500 px-6 py-4 font-bold text-white shadow-md hover:bg-green-400 cursor-pointer"
						>
							{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Rankings</>}
						</Button>
						<Link href="/dashboard/mycca/admin">
							<Button variant="outline" size="lg" className="px-6 py-4"><ArrowLeft className="h-4 w-4" /> Back to my CCAs</Button>
						</Link>
					</div>
				</div>

				{unrankedCount > 0 && (
					<Alert className="mb-4 border-yellow-200 bg-yellow-50">
						<AlertCircle className="h-4 w-4 text-yellow-600" />
						<AlertTitle className="text-yellow-800">Pending Rankings</AlertTitle>
						<AlertDescription className="text-yellow-700">
							You have {unrankedCount} member{unrankedCount !== 1 ? "s" : ""} left to rank. Complete the required score inputs for each member to finalize the order.
						</AlertDescription>
					</Alert>
				)}

				{isLoading ? (
					<div className="flex justify-center py-8"><LoadingSpinner /></div>
				) : error ? (
					<Alert className="mb-4 border-yellow-200 bg-yellow-50">
						<AlertCircle className="h-4 w-4 text-yellow-600" />
						<AlertTitle className="text-yellow-800">Unable to load rankings</AlertTitle>
						<AlertDescription className="text-yellow-700">{error}</AlertDescription>
					</Alert>
				) : positionGroups.length > 0 ? (
					<div className="space-y-6">
						{positionGroups.map((group) => (
							<PositionRankingCard key={group.position_id} group={group} ccaType={ccaType} onFieldChange={handleFieldChange} />
						))}
						<div className="text-sm text-muted-foreground">Ranking updates automatically based on score.</div>
					</div>
				) : (
					<div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-gray-500">No members found</div>
				)}
			</div>
		</AppLayout>
	);
}
