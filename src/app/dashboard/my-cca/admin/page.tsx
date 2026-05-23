"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorCard } from "@/components/layout/error-card";
import Link from "next/link";
import { useManagedCcas } from "@/features/cca/hooks/use-managed-ccas";
import type { CCAData } from "@/features/cca/types/cca-data";
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
		accessorKey: "positions",
		header: () => <div className="font-semibold">Managed Positions</div>,
		enableSorting: false,
		cell: ({ row }) => {
			const positions = row.original.positions ?? [];

			if (positions.length === 0) {
				return <div className="text-xs text-muted-foreground">No managed positions</div>;
			}

			return (
				<div className="flex min-w-[12rem] flex-col items-start gap-2">
					{positions.map((position) => (
						<PositionTypeBadge
							key={position.position_id}
							value={position.position_name}
							positionType={position.position_type}
							className="text-xs"
						/>
					))}
				</div>
			);
		},
	},
];

export default function CCAAdmin() {
	const { data: ccas, loading: loadingCCAs, error } = useManagedCcas();

	if (loadingCCAs) {
		return <LoadingSpinner message="Loading your CCA data..." />;
	}

	if (error && ccas.length === 0) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="CCA Admin" />
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
				title="CCA Admin"
				backHref="/dashboard/my-cca"
				backLabel="Back to My CCAs"
			/>

			{ccas.length === 0 ? (
				<EmptyState
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
