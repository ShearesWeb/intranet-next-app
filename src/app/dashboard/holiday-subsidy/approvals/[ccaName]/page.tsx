"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";

import { DeclarationSectionCard } from "@/features/holiday-subsidy/components/declaration-section-card";
import { useSubsidyApprovalDetails } from "@/features/holiday-subsidy/hooks/use-subsidy-approval-details";
import {
	SubsidyStatus,
	type DeclarationSection,
} from "@/features/holiday-subsidy/types/declarations";
import { formatSubsidyStatus } from "@/features/holiday-subsidy/utils/declaration-mappers";
import { HOLIDAY_WEEK_OPTIONS } from "@/features/holiday-subsidy/utils/holiday-weeks";

const STATUS_ORDER: SubsidyStatus[] = [
	SubsidyStatus.PENDING,
	SubsidyStatus.APPROVED,
	SubsidyStatus.REJECTED,
];

type ApprovalAction = { label: string; target: SubsidyStatus; variant: "default" | "destructive" };

const APPROVAL_ACTIONS: Record<SubsidyStatus, ApprovalAction[]> = {
	[SubsidyStatus.PENDING]: [
		{ label: "Approve", target: SubsidyStatus.APPROVED, variant: "default" },
		{ label: "Reject", target: SubsidyStatus.REJECTED, variant: "destructive" },
	],
	[SubsidyStatus.APPROVED]: [
		{ label: "Reject", target: SubsidyStatus.REJECTED, variant: "destructive" },
	],
	[SubsidyStatus.REJECTED]: [
		{ label: "Approve", target: SubsidyStatus.APPROVED, variant: "default" },
	],
};

export default function HolidaySubsidyApprovalDetailsPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const ccaNameParam = params?.ccaName;
	const ccaNameUrl = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";
	const ccaId = searchParams.get("ccaId");

	const { ccaName, declarations, loading, saving, error, hasChanges, updateStatus, save } =
		useSubsidyApprovalDetails(ccaId, ccaNameUrl);

	const sections = useMemo<DeclarationSection[]>(
		() =>
			STATUS_ORDER.map((status) => ({
				key: status,
				title: `${formatSubsidyStatus(status)} Declarations`,
				data: declarations.filter((declaration) => declaration.status === status),
			})),
		[declarations],
	);

	// Warn user before leaving page with unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasChanges) {
				e.preventDefault();
				e.returnValue = "";
				return "";
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasChanges]);

	const handleBack = useCallback(() => {
		if (hasChanges && !confirm("You have unsaved changes. Leave without saving?")) return;
		window.location.href = "/dashboard/holiday-subsidy/approvals";
	}, [hasChanges]);

	if (!user?.is_jcrc) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6 max-w-3xl">
				<h1 className="text-2xl font-semibold">Holiday Subsidy Approvals</h1>
				<Card>
					<CardContent className="p-6 space-y-2">
						<div className="text-lg font-semibold">JCRC access only</div>
						<p className="text-sm text-muted-foreground">
							This page is restricted to JCRC members responsible for approving subsidy declarations
							and weekly commitments.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (loading) {
		return <LoadingSpinner message="Loading subsidy approvals..." />;
	}

	if (!ccaId) return null;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">
						JCRC Holiday Subsidy Approvals - {ccaName || `CCA #${ccaId}`}
					</h1>
					<p className="text-muted-foreground text-sm">
						Review, approve, or reject subsidy declarations for this CCA.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onClick={handleBack}>
						← Back to approvals
					</Button>
					<Button onClick={save} disabled={!hasChanges || saving} size="sm">
						{saving ? "Saving..." : "Save changes"}
					</Button>
				</div>
			</div>

			<Separator />

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : (
				<Tabs defaultValue={SubsidyStatus.PENDING} className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						{sections.map((section) => (
							<TabsTrigger key={section.key} value={section.key}>
								{formatSubsidyStatus(section.key)} ({section.data.length})
							</TabsTrigger>
						))}
					</TabsList>
					{sections.map((section) => (
						<TabsContent key={section.key} value={section.key} className="mt-4">
							<DeclarationSectionCard
								section={section}
								weekOptions={HOLIDAY_WEEK_OPTIONS}
								headerExtra={
									section.key === SubsidyStatus.PENDING && hasChanges ? (
										<span className="text-sm text-muted-foreground">Unsaved changes</span>
									) : null
								}
								renderActions={(declaration) =>
									APPROVAL_ACTIONS[section.key].map((action) => (
										<Button
											key={action.target}
											variant={action.variant}
											size="sm"
											type="button"
											onClick={() => updateStatus(declaration, action.target)}
										>
											{action.label}
										</Button>
									))
								}
							/>
						</TabsContent>
					))}
				</Tabs>
			)}
		</div>
	);
}
