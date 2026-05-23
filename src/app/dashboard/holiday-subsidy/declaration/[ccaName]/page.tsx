"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { DeclarationSectionCard } from "@/features/holiday-subsidy/components/declaration-section-card";
import { SubsidyDeclarationFormDialog } from "@/features/holiday-subsidy/components/subsidy-declaration-form-dialog";
import { useSubsidyDeclarations } from "@/features/holiday-subsidy/hooks/use-subsidy-declarations";
import {
	SubsidyStatus,
	type DeclarationSection,
} from "@/features/holiday-subsidy/types/declarations";
import { HOLIDAY_WEEK_OPTIONS } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { formatSubsidyStatus } from "@/features/holiday-subsidy/utils/declaration-mappers";

const STATUS_ORDER: SubsidyStatus[] = [
	SubsidyStatus.PENDING,
	SubsidyStatus.APPROVED,
	SubsidyStatus.REJECTED,
];

export default function SubsidyDeclarationPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const ccaNameParam = params?.ccaName;
	const ccaName = typeof ccaNameParam === "string" ? decodeURIComponent(ccaNameParam) : "";
	const ccaId = searchParams.get("ccaId");

	const router = useRouter();

	const {
		positions,
		declarations,
		loading,
		error,
		dialogOpen,
		editingDeclaration,
		openCreateDialog,
		openEditDialog,
		handleDialogOpenChange,
		handleDelete,
		handleDeclarationSaved,
		mapApiSubsidy,
	} = useSubsidyDeclarations(ccaId);

	useEffect(() => {
		if (!ccaName) {
			router.replace("/dashboard/holiday-subsidy");
		}
	}, [ccaName, router]);

	const sections = useMemo<DeclarationSection[]>(
		() =>
			STATUS_ORDER.map((status) => ({
				key: status,
				title: `${formatSubsidyStatus(status)} Declarations`,
				data: declarations.filter((declaration) => declaration.status === status),
			})),
		[declarations],
	);

	if (!ccaName) {
		return null;
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">Subsidy Declaration - {ccaName}</h1>
					<p className="text-muted-foreground text-sm">
						Submit and track your weekly subsidy declarations.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm" className="gap-2">
						<Link href="/dashboard/holiday-subsidy">
							<ArrowLeft className="h-4 w-4" />
							Back to CCAs
						</Link>
					</Button>
					<Button size="sm" onClick={openCreateDialog}>
						Declare New Subsidy
					</Button>
					{ccaId ? (
						<SubsidyDeclarationFormDialog
							ccaId={ccaId}
							ccaName={ccaName}
							positions={positions}
							weekOptions={HOLIDAY_WEEK_OPTIONS}
							open={dialogOpen}
							editingDeclaration={editingDeclaration}
							onOpenChange={handleDialogOpenChange}
							onSubmitSuccess={handleDeclarationSaved}
							mapSubsidyToDeclaration={mapApiSubsidy}
						/>
					) : null}
				</div>
			</div>

			{loading ? (
				<div className="flex justify-center items-center py-12">
					<Spinner className="w-8 h-8" />
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : positions.length === 0 ? (
				<Card className="border-dashed bg-muted/40">
					<CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
						<p className="text-lg font-semibold">No positions found for this CCA.</p>
						<p className="text-sm text-muted-foreground">
							Ensure you have chair access and positions are configured for this CCA.
						</p>
					</CardContent>
				</Card>
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
								onEdit={openEditDialog}
								onDelete={handleDelete}
							/>
						</TabsContent>
					))}
				</Tabs>
			)}
		</div>
	);
}
