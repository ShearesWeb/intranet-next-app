"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { ApprovalCcaTable } from "@/components/holiday-subsidy/approval-cca-table";
import { useSubsidyApprovalsIndex } from "@/hooks/use-subsidy-approvals-index";

export default function HolidaySubsidyApprovalsPage() {
	const { user } = useAuth();
	const { rows, loading, error } = useSubsidyApprovalsIndex();

	const isAuthorized = Boolean(user?.is_jcrc);

	if (!isAuthorized) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6 max-w-3xl">
				<PageHeader title="Holiday Subsidy Approvals" />
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
			<PageHeader
				title="Holiday Subsidy Approvals"
				description="Review all CCAs and see how many subsidy declarations or weekly commitments are pending approval."
			/>
			<ApprovalCcaTable rows={rows} error={error} />
		</div>
	);
}
