"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MailOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorCard } from "@/components/layout/error-card";
import { useCcaList } from "@/hooks/use-cca-list";
import { useAllocationReveal } from "@/hooks/use-allocation-reveal";
import { AllocationRevealOverlay } from "@/components/cca/allocation-reveal-overlay";
import type { CCAData } from "@/types/cca-data";
import { PositionTypeBadge } from "@/components/badges";
import { ccaNameColumn, ccaKindColumn } from "@/components/cca/cca-column-defs";

const ccaTableColumns: ColumnDef<CCAData>[] = [
	ccaNameColumn,
	{
		accessorKey: "role",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">Role</span>
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 w-8 p-0"
				>
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			</div>
		),
		cell: ({ row }) => (
			<PositionTypeBadge
				value={String(row.getValue("role"))}
				positionType={String(row.original.position_type || "")}
				className="text-xs"
			/>
		),
	},
	ccaKindColumn,
	{
		accessorKey: "points",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">Points</span>
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 w-8 p-0"
				>
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			</div>
		),
		cell: ({ row }) => (
			<div className="font-semibold text-center text-sm md:text-base">
				{String(row.getValue("points"))}
			</div>
		),
	},
];

export default function MyCCAs() {
	const { data: ccas, loading: loadingCCAs, error } = useCcaList();
	const { reveal, open, replay, dismiss } = useAllocationReveal(ccas, !loadingCCAs && !error);

	if (loadingCCAs) {
		return <DashboardTableSkeleton rows={6} cols={4} />;
	}

	if (error && ccas.length === 0) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="My CCAs" />
				<ErrorCard error={error} onRetry={() => window.location.reload()} />
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<PageHeader title="My CCAs" description="View all your CCA appointments and points." />
				{reveal && (
					<Button variant="outline" onClick={replay} className="shrink-0">
						<MailOpen className="h-4 w-4" />
						{reveal.periodLabel} reveal
					</Button>
				)}
			</div>

			{reveal && open && <AllocationRevealOverlay reveal={reveal} onClose={dismiss} />}

			{ccas.length === 0 ? (
				<EmptyState
					icon={Users}
					title="No CCA appointments found."
					description="You have not been assigned to any CCAs yet. Check back later or contact your CCA chairs/ICs."
				/>
			) : (
				<DataTable<CCAData>
					data={ccas}
					columns={ccaTableColumns}
					pageSize={10}
					emptyMessage="No CCAs found"
				/>
			)}
		</div>
	);
}
