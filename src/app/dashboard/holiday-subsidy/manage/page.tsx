"use client";

import { Info, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { ChairCcaTable } from "@/components/holiday-subsidy/chair-cca-table";
import { useChairSubsidyCcas } from "@/hooks/use-chair-subsidy-ccas";

export default function HolidaySubsidyManage() {
	const { user } = useAuth();
	const { subsidyData, loading, hasChairAccess, error } = useChairSubsidyCcas(user);

	if (loading) {
		return <LoadingSpinner message="Loading your CCAs..." />;
	}

	if ((error && subsidyData.length === 0) || (!hasChairAccess && !error)) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader
					title="Subsidy Declaration"
					description="Review your CCAs, see pending hours, and jump straight into the subsidy declaration page for each role."
				/>
				<Card className="bg-gradient-to-br from-muted/40 to-background">
					<CardContent className="flex flex-col gap-3 p-6">
						<ShieldX className="h-8 w-8 text-muted-foreground/60 mb-2" />
						<div className="text-lg font-semibold">You are not a chair/vice for any CCA.</div>
						<p className="text-sm text-muted-foreground">
							Only CCA leads and vice leads can submit holiday subsidy declarations. If you believe
							this is a mistake, please contact your CCA administrator.
						</p>
						{error && <div className="text-sm text-destructive">{error}</div>}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Subsidy Declaration"
				description="Review your CCAs, see pending hours, and jump straight into the subsidy declaration page for each role."
			/>
			<div className="flex flex-col gap-3">
				<div className="space-y-1">
					<div className="text-lg font-semibold">Your CCAs</div>
					<div className="text-muted-foreground text-sm flex items-center gap-2">
						<Info className="h-4 w-4" />
						Chairs/ICs can submit holiday subsidy declarations per CCA.
					</div>
				</div>
				<ChairCcaTable data={subsidyData} />
			</div>
		</div>
	);
}
