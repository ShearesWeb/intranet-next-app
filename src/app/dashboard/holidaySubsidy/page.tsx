"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/AuthContext";
import { ChairCcaTable } from "@/features/holiday-subsidy/components/chair-cca-table";
import { useChairSubsidyCcas } from "@/features/holiday-subsidy/hooks/use-chair-subsidy-ccas";

export default function HolidaySubsidyLanding() {
	const { user } = useAuth();
	const { subsidyData, loading, hasChairAccess, error } = useChairSubsidyCcas(user);

	if (loading) {
		return <LoadingSpinner message="Loading your CCAs..." />;
	}

	if ((error && subsidyData.length === 0) || (!hasChairAccess && !error)) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold">Holiday Subsidy</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Review your CCAs, see pending hours, and jump straight into the subsidy declaration page
						for each role.
					</p>
				</div>
				<Card className="bg-muted/40">
					<CardContent className="flex flex-col gap-3 p-6">
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
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">Holiday Subsidy</h1>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Review your CCAs, see pending hours, and jump straight into the subsidy declaration page
					for each role.
				</p>
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<div className="space-y-1">
						<div className="text-lg font-semibold">Your CCAs</div>
						<div className="text-muted-foreground text-sm flex items-center gap-2">
							<Info className="h-4 w-4" />
							Chairs/ICs can submit holiday subsidy declarations per CCA.
						</div>
					</div>
					<Button asChild variant="default" size="sm" className="self-start sm:self-center">
						<Link href="/dashboard/holidaySubsidy/guide">View Guide</Link>
					</Button>
				</div>
				<ChairCcaTable data={subsidyData} />
			</div>
		</div>
	);
}
