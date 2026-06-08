"use client";

import React from "react";
import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useApplicantRankings } from "@/hooks/use-applicant-rankings";
import { DataTable, type DataTableColumnDef } from "@/components/table/data-table";
import {
	deriveCcaRankingStatus,
	CCA_RANKING_STATUS_LABELS,
	type CcaRankingStatus,
} from "@/lib/allocation/cca-ranking-status";
import type { CcaPositionGroup } from "@/types/applicants";

interface CcaRow {
	cca_id: number;
	cca_name: string;
	positionCount: number;
	applicantCount: number;
	status: CcaRankingStatus;
}

const STATUS_STYLES: Record<CcaRankingStatus, string> = {
	ranked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	"needs-ranking": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
	"no-applicants": "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: CcaRankingStatus }) {
	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
		>
			{CCA_RANKING_STATUS_LABELS[status]}
		</span>
	);
}

export default function RankApplicants() {
	const { user } = useAuth();
	const { ccaGroups, positions, loading, mounted } = useApplicantRankings(user?.email);

	const rows = React.useMemo<CcaRow[]>(
		() =>
			ccaGroups.map((group: CcaPositionGroup) => ({
				cca_id: group.cca_id,
				cca_name: group.cca_name,
				positionCount: group.positions.length,
				applicantCount: group.positions.reduce((sum, p) => sum + p.applicants.length, 0),
				status: deriveCcaRankingStatus(group),
			})),
		[ccaGroups],
	);

	const columns = React.useMemo<DataTableColumnDef<CcaRow>[]>(
		() => [
			{
				accessorKey: "cca_name",
				header: "CCA",
				cell: ({ row }) => <span className="font-medium">{row.original.cca_name}</span>,
			},
			{
				accessorKey: "positionCount",
				header: "Positions",
				cell: ({ row }) => <span className="tabular-nums">{row.original.positionCount}</span>,
			},
			{
				accessorKey: "applicantCount",
				header: "To rank",
				enableSorting: true,
				cell: ({ row }) => (
					<span className="flex items-center gap-1 tabular-nums text-muted-foreground">
						<Users className="h-3.5 w-3.5" />
						{row.original.applicantCount}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => <StatusPill status={row.original.status} />,
			},
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex justify-end">
						<Button asChild size="sm" className="gap-1">
							<Link
								href={`/dashboard/cca-allocation/rank-applicants/${encodeURIComponent(row.original.cca_name)}?ccaId=${row.original.cca_id}`}
							>
								Rank
								<ChevronRight className="h-4 w-4" />
							</Link>
						</Button>
					</div>
				),
			},
		],
		[],
	);

	if (!mounted || !user) return <LoadingSpinner message="Loading..." />;
	if (loading) return <LoadingSpinner message="Loading CCA positions and applicants..." />;

	const totalApplicants = positions.reduce((sum, p) => sum + p.applicants.length, 0);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Chair preferences"
				description="Pick a CCA to rank its applicants. Open one to drag, search and reorder."
			/>

			{rows.length === 0 ? (
				<EmptyState
					title="No CCA positions to manage"
					description="You don't manage any positions with available capacity. This could mean all positions are filled, or you don't have chair/reporting-chain access to any CCA."
				/>
			) : (
				<>
					<div className="text-sm text-muted-foreground">
						{rows.length} CCA{rows.length > 1 ? "s" : ""} · {positions.length} position
						{positions.length > 1 ? "s" : ""} · {totalApplicants} applicant
						{totalApplicants !== 1 ? "s" : ""}
					</div>

					<DataTable<CcaRow>
						data={rows}
						columns={columns}
						searchColumn="cca_name"
						searchPlaceholder="Search CCAs..."
						idField="cca_id"
						emptyMessage="No CCAs match your search."
					/>
				</>
			)}
		</div>
	);
}
