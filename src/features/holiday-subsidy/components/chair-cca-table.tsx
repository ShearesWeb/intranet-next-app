"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowRight, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PositionTypeBadge } from "@/components/badges";
import type { ChairSubsidyRow } from "@/features/holiday-subsidy/hooks/use-chair-subsidy-ccas";

const columns: ColumnDef<ChairSubsidyRow>[] = [
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
		cell: ({ row }) => <div className="font-semibold">{String(row.getValue("name"))}</div>,
	},
	{
		accessorKey: "position_name",
		header: () => <div className="font-semibold">Your Position</div>,
		enableSorting: false,
		cell: ({ row }) => (
			<PositionTypeBadge
				value={row.original.position_name}
				positionType={row.original.position_type}
				className="capitalize"
			/>
		),
	},
	{
		id: "actions",
		header: () => <div className="font-semibold">Actions</div>,
		enableSorting: false,
		cell: ({ row }) => (
			<div className="flex flex-col sm:flex-row sm:items-center justify-end sm:justify-start gap-2 w-full sm:w-auto">
				<Link
					href={`/dashboard/holiday-subsidy/declaration/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
				>
					<Button size="sm" variant="outline" className="gap-2 px-3 py-2">
						Subsidy Declaration
						<ArrowRight className="h-4 w-4" />
					</Button>
				</Link>
				<Link
					href={`/dashboard/holiday-subsidy/weekly/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
				>
					<Button size="sm" className="gap-2 px-3 py-2">
						Weekly Commitment Declaration
						<ArrowRight className="h-4 w-4" />
					</Button>
				</Link>
			</div>
		),
	},
];

export function ChairCcaTable({ data }: { data: ChairSubsidyRow[] }) {
	return (
		<DataTable
			data={data}
			columns={columns}
			searchColumn="name"
			searchPlaceholder="Search CCA..."
			pageSize={5}
			emptyMessage="No CCAs found."
			tableContainerClassName="rounded-lg border bg-card/40 overflow-hidden"
			tableClassName="min-w-full [&_th]:px-5 [&_td]:px-5"
		/>
	);
}
