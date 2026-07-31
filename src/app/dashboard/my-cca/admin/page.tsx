"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorCard } from "@/components/layout/error-card";
import Link from "next/link";
import { useManagedCcas } from "@/hooks/use-managed-ccas";
import type { CCAData } from "@/types/cca-data";
import { RankingProgressBar } from "@/components/ranking/ranking-progress-bar";
import { ccaNameColumn, ccaTypeColumn } from "@/components/cca/cca-column-defs";

const ccaTableColumns: ColumnDef<CCAData>[] = [
	ccaNameColumn,
	ccaTypeColumn,
	{
		accessorKey: "ranking_progress",
		header: () => <div className="font-semibold">Ranking Progress</div>,
		enableSorting: false,
		cell: ({ row }) => {
			const progress = row.original.ranking_progress;

			if (!progress) {
				return <div className="text-xs text-muted-foreground">-</div>;
			}

			return <RankingProgressBar ranked={progress.ranked} total={progress.total} />;
		},
	},
];

export default function CCAAdmin() {
	const { data: ccas, loading: loadingCCAs, error } = useManagedCcas();

	if (loadingCCAs) {
		return <DashboardTableSkeleton rows={6} cols={4} />;
	}

	if (error && ccas.length === 0) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="CCA Ranking" />
				<ErrorCard error={error} onRetry={() => window.location.reload()} />
			</div>
		);
	}

	const dynamicColumns: ColumnDef<CCAData>[] = [
		...ccaTableColumns,
		{
			id: "actions",
			header: () => <div className="font-semibold">Actions</div>,
			enableSorting: false,
			cell: ({ row }) => {
				const allowManage = Boolean(row.original.can_manage_members);
				const allowRank = Boolean(row.original.can_rank_members);

				return (
					<div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
						{allowManage && (
							<Button asChild size="sm" className="gap-2">
								<Link
									href={`/dashboard/my-cca/admin/manage-members/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
								>
									<Users className="h-4 w-4" />
									Manage Members
								</Link>
							</Button>
						)}
						{allowRank && (
							<Button asChild variant="outline" size="sm" className="gap-2">
								<Link
									href={`/dashboard/my-cca/admin/rank-members/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
								>
									<BarChart3 className="h-4 w-4" />
									Rank Members
								</Link>
							</Button>
						)}
					</div>
				);
			},
		},
	];

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="CCA Ranking"
				description="Manage members and rankings for your CCAs."
				backHref="/dashboard/my-cca"
				backLabel="Back to My CCAs"
			/>

			{ccas.length === 0 ? (
				<EmptyState
					icon={ShieldCheck}
					title="No manageable CCAs found."
					description="You do not have admin permissions for any CCAs."
				/>
			) : (
				<DataTable<CCAData>
					data={ccas}
					columns={dynamicColumns}
					searchColumn="name"
					searchPlaceholder="Search CCA..."
					pageSize={10}
					emptyMessage="No CCAs found"
				/>
			)}
		</div>
	);
}
