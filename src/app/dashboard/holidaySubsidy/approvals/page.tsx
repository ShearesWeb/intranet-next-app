"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/context/AuthContext";
import { ApprovalCcaTable } from "@/features/holiday-subsidy/components/approval-cca-table";
import { useSubsidyApprovalsIndex } from "@/features/holiday-subsidy/hooks/use-subsidy-approvals-index";

export default function HolidaySubsidyApprovalsPage() {
	const { user } = useAuth();
	const { rows, loading, error } = useSubsidyApprovalsIndex();

	const isAuthorized = Boolean(user?.is_jcrc);

	if (!isAuthorized) {
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
		return <LoadingSpinner message="Loading approvals..." />;
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold">Holiday Subsidy Approvals</h1>
				<p className="text-muted-foreground text-sm">
					Review all CCAs and see how many subsidy declarations or weekly commitments are pending
					approval.
				</p>
			</div>
			<ApprovalCcaTable rows={rows} error={error} />
		</div>
	);
}
