"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOLIDAY_WEEKS } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { useWeeklyApprovals } from "@/features/holiday-subsidy/hooks/use-weekly-approvals";
import { WeeklyApprovalsTable } from "@/features/holiday-subsidy/components/weekly-approvals-table";
import { WeeklyPageHeader } from "@/features/holiday-subsidy/components/weekly-page-header";

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
		toggleSelected,
		ccaName,
		loading,
		isLoadingData,
		error,
		handleApprove,
		handleReject,
	} = useWeeklyApprovals(ccaId, ccaNameUrl);

	// TODO: Re-enable JCRC authorization check after testing
	// The API route handles authorization for now

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<WeeklyPageHeader
				title={`Weekly Commitment Approval${ccaName ? ` - ${ccaName}` : ""}`}
				description="Review and approve weekly hours committed by CCA members during the holiday period."
				backHref="/dashboard/holidaySubsidy/approvals"
				backLabel="Back to Approvals"
			/>

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
				loading={loading}
				isLoadingData={isLoadingData}
				error={error}
				onToggleSelected={toggleSelected}
				onApprove={handleApprove}
				onReject={handleReject}
			/>
		</div>
	);
}
