"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorCard } from "@/components/layout/error-card";
import { useCcaList } from "@/hooks/use-cca-list";
import type { CCAData } from "@/types/cca-data";
import { PositionTypeBadge, CcaTypeBadge } from "@/components/badges";

const ccaTableColumns: ColumnDef<CCAData>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">CCA</span>
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
			<div className="flex flex-col gap-2 pr-4">
				<strong className="font-semibold text-sm md:text-base">{row.getValue("name")}</strong>
				{row.original.description && (
					<div className="text-xs md:text-sm text-muted-foreground break-words whitespace-normal text-justify leading-relaxed line-clamp-5">
						{row.original.description}
					</div>
				)}
			</div>
		),
	},
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
	{
		accessorKey: "cca_type",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">Type</span>
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 w-8 p-0"
				>
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			</div>
		),
		cell: ({ row }) => <CcaTypeBadge value={String(row.getValue("cca_type"))} className="text-xs" />,
	},
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
			<div className="font-semibold text-center text-sm md:text-base">{String(row.getValue("points"))}</div>
		),
	},
];

export default function MyCCAs() {
	const { data: ccas, loading: loadingCCAs, error } = useCcaList();

	if (loadingCCAs) {
		return <LoadingSpinner message="Loading your CCA data..." />;
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
			<PageHeader title="My CCAs" />

			{ccas.length === 0 ? (
				<EmptyState
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
