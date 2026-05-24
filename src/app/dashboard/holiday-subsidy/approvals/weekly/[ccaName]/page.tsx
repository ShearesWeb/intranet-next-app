"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOLIDAY_WEEKS } from "@/lib/holiday-subsidy/holiday-weeks";
import { useWeeklyApprovals } from "@/hooks/use-weekly-approvals";
import { WeeklyApprovalsTable } from "@/components/holiday-subsidy/weekly-approvals-table";
import { WeeklyPageHeader } from "@/components/holiday-subsidy/weekly-page-header";

export default function WeeklyCommitmentApprovalPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const ccaNameParam = params?.ccaName;
	const ccaNameUrl = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";
	const ccaId = searchParams.get("ccaId");

	const {
		weekIndex,
		weekInfo,
		handleWeekChange,
		rows,
		selected,
		pendingStatus,
		toggleSelected,
		ccaName,
		saving,
		isLoadingData,
		error,
		hasChanges,
		stageApprove,
		stageReject,
		save,
	} = useWeeklyApprovals(ccaId, ccaNameUrl);

	const handleBackClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (hasChanges && !confirm("You have unsaved changes. Leave without saving?")) {
			e.preventDefault();
		} else {
			window.location.href = "/dashboard/holiday-subsidy/approvals";
		}
	};

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<WeeklyPageHeader
				title={`Weekly Commitment Approval${ccaName ? ` - ${ccaName}` : ""}`}
				description="Review and approve weekly hours committed by CCA members during the holiday period."
				backHref="/dashboard/holiday-subsidy/approvals"
				backLabel="Back to approvals"
				onBackClick={handleBackClick}
				onSave={save}
				saveDisabled={saving || !hasChanges}
				isSaving={saving}
			/>

			{hasChanges && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
					<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
						You have {pendingStatus.size} staged change{pendingStatus.size === 1 ? "" : "s"} for{" "}
						{weekInfo.label}. Click &quot;Save for the week&quot; to commit them.
					</p>
				</div>
			)}

			<div className="space-y-3">
				<Tabs
					value={HOLIDAY_WEEKS[weekIndex].label}
					onValueChange={(val) => {
						const idx = HOLIDAY_WEEKS.findIndex((w) => w.label === val);
						if (idx >= 0) handleWeekChange(idx);
					}}
				>
					<TabsList className="flex flex-wrap gap-2 bg-transparent p-1 border-0 h-auto">
						{HOLIDAY_WEEKS.map((week, idx) => {
							const active = idx === weekIndex;
							return (
								<TabsTrigger
									key={week.id}
									value={week.label}
									className="flex flex-col items-start gap-1 px-4 py-3 rounded-lg border data-[state=inactive]:bg-background data-[state=inactive]:text-foreground data-[state=inactive]:border-border data-[state=inactive]:hover:border-primary/50 data-[state=inactive]:hover:bg-accent data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-primary/20 transition-all"
								>
									<span className="text-sm font-semibold">{week.label}</span>
									<span
										className={`text-[11px] ${active ? "text-primary/80" : "text-muted-foreground"}`}
									>
										{week.range}
									</span>
								</TabsTrigger>
							);
						})}
					</TabsList>
				</Tabs>
			</div>

			<WeeklyApprovalsTable
				weekLabel={weekInfo.label}
				rows={rows}
				selected={selected}
				pendingStatus={pendingStatus}
				saving={saving}
				isLoadingData={isLoadingData}
				error={error}
				onToggleSelected={toggleSelected}
				onStageApprove={stageApprove}
				onStageReject={stageReject}
			/>
		</div>
	);
}
