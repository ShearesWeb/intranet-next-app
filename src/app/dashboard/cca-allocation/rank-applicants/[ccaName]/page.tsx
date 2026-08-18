"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useApplicantRankings } from "@/hooks/use-applicant-rankings";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { PositionCard } from "@/components/allocation/position-card";
import type { Applicant, Position } from "@/types/applicants";
import type { UserSearchResult } from "@/types/members";

const OVERVIEW_HREF = "/dashboard/cca-allocation/rank-applicants";

export default function RankCcaApplicants() {
	const { user } = useAuth();
	const router = useRouter();
	const params = useParams();
	const searchParams = useSearchParams();

	const ccaNameParam = params?.ccaName;
	const ccaNameFromUrl = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";
	const ccaIdParam = searchParams.get("ccaId");
	const ccaId = ccaIdParam ? Number(ccaIdParam) : undefined;

	const {
		ccaGroups,
		loading,
		isSaving,
		hasChanges,
		hasAnyChanges,
		mounted,
		handleAddApplicant,
		handleRankApplicant,
		handleRemoveApplicant,
		handleReorderApplicants,
		handleSaveAll,
	} = useApplicantRankings(user?.email, { ccaId });

	// Warn on full-page unload (refresh / close) while there are unsaved changes.
	useBeforeUnload(hasAnyChanges);

	const goBack = React.useCallback(() => {
		if (hasAnyChanges && !window.confirm("You have unsaved changes. Leave without saving?")) {
			return;
		}
		router.push(OVERVIEW_HREF);
	}, [hasAnyChanges, router]);

	if (!mounted || !user) return <LoadingSpinner message="Loading..." />;
	if (loading) return <LoadingSpinner message="Loading applicants..." />;

	const group = ccaGroups[0];

	if (ccaId === undefined || !group) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="Chair preferences" backHref={OVERVIEW_HREF} backLabel="Back" />
				<EmptyState
					title="CCA not found"
					description="This CCA isn't available to rank — it may be filled, or you don't have chair access. Go back and pick one from the list."
				/>
			</div>
		);
	}

	const ccaName = group.cca_name || ccaNameFromUrl;
	const totalApplicants = group.positions.reduce((sum, p) => sum + p.applicants.length, 0);
	const dirtyCount = group.positions.filter((p) => hasChanges[p.id]).length;

	const saveButton = (
		<Button onClick={handleSaveAll} disabled={isSaving || !hasAnyChanges}>
			{isSaving ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Saving...
				</>
			) : hasAnyChanges ? (
				`Save ${dirtyCount} position${dirtyCount > 1 ? "s" : ""}`
			) : (
				"All saved"
			)}
		</Button>
	);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title={ccaName}
				description={`${group.positions.length} position${group.positions.length > 1 ? "s" : ""} · ${totalApplicants} candidate${totalApplicants !== 1 ? "s" : ""} ranked. Drag or use the move buttons to rank, then save.`}
				actions={
					<>
						<Button variant="outline" size="sm" className="group gap-2" onClick={goBack}>
							<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
							Back
						</Button>
						{saveButton}
					</>
				}
			/>

			{hasAnyChanges && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
					<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
						You have unsaved changes in {dirtyCount} position{dirtyCount > 1 ? "s" : ""}. Don&apos;t
						forget to save!
					</p>
				</div>
			)}

			<div className="flex flex-col divide-y divide-border">
				{group.positions.map((pos: Position) => (
					<div key={pos.id} className="py-8 first:pt-0 last:pb-0">
						<PositionCard
							position={pos}
							hasChanges={hasChanges[pos.id] || false}
							onAddApplicant={(userData: UserSearchResult) => handleAddApplicant(pos.id, userData)}
							onRankApplicant={(userId: number) => handleRankApplicant(pos.id, userId)}
							onRemoveApplicant={(userId: number) => handleRemoveApplicant(pos.id, userId)}
							onReorderApplicants={(newApplicants: Applicant[]) =>
								handleReorderApplicants(pos.id, newApplicants)
							}
						/>
					</div>
				))}
			</div>

			{isSaving && <LoadingSpinner message="Saving preferences..." overlay />}
		</div>
	);
}
