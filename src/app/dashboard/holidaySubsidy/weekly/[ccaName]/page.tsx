"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { HOLIDAY_WEEKS } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { useWeeklyCommitment } from "@/features/holiday-subsidy/hooks/use-weekly-commitment";
import { WeeklyCommitmentTable } from "@/features/holiday-subsidy/components/weekly-commitment-table";
import { WeeklyPageHeader } from "@/features/holiday-subsidy/components/weekly-page-header";

export default function WeeklyCommitmentPage() {
	const searchParams = useSearchParams();
	const ccaId = searchParams.get("ccaId");

	const {
		weekIndex,
		editableWeekIds,
		weekInfo,
		isWeekOpen,
		handleWeekChange,
		rows,
		selected,
		toggleSelected,
		handleChange,
		isLoading,
		isSaving,
		canSave,
		hasUnsavedChanges,
		error,
		handleSave,
	} = useWeeklyCommitment(ccaId);

	if (isLoading) {
		return <LoadingSpinner message="Loading weekly commitment data..." />;
	}

	if (error) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
				<h1 className="text-2xl font-semibold">Weekly Commitment Declaration</h1>
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button asChild variant="outline" size="sm" className="gap-2">
					<Link href="/dashboard/holidaySubsidy">
						<ArrowLeft className="h-4 w-4" />
						Back to CCAs
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<WeeklyPageHeader
				title="Weekly Commitment Declaration"
				description="Record and manage weekly hours committed by your CCA members during the holiday period."
				backHref="/dashboard/holidaySubsidy"
				backLabel="Back to CCAs"
				onBackClick={(e) => {
					if (hasUnsavedChanges && !confirm("You have unsaved changes. Leave without saving?")) {
						e.preventDefault();
					} else {
						window.location.href = "/dashboard/holidaySubsidy";
					}
				}}
				onSave={handleSave}
				saveDisabled={isSaving || !isWeekOpen || !canSave}
				isSaving={isSaving}
			/>

			{!isWeekOpen && (
				<Alert variant="destructive" className="flex items-center gap-3">
					<AlertCircle className="h-5 w-5" />
					<AlertDescription>
						Weekly declarations are closed for {weekInfo.label}. You can only submit for the current
						week or the previous week until Tuesday 23:59.
					</AlertDescription>
				</Alert>
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
									disabled={!editableWeekIds.includes(week.id)}
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

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">Member Commitments - {weekInfo.label}</CardTitle>
				</CardHeader>
				<CardContent>
					<WeeklyCommitmentTable
						rows={rows}
						selected={selected}
						isWeekOpen={isWeekOpen}
						onToggleSelected={toggleSelected}
						onChange={handleChange}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
