"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import type { ChairSubsidyRow } from "@/features/holiday-subsidy/hooks/use-chair-subsidy-ccas";

const columns: SimpleTableColumn<ChairSubsidyRow>[] = [
	{
		accessorKey: "name",
		header: "CCA",
		cell: (value) => <div className="font-semibold">{String(value)}</div>,
	},
	{
		accessorKey: "position_name",
		header: "Your Position",
		enableSorting: false,
		cell: (_, row) => (
			<PositionTypeBadge
				value={row.position_name}
				position_type={row.position_type}
				className="capitalize"
			/>
		),
	},
	{
		accessorKey: "actions" as keyof ChairSubsidyRow,
		header: "Actions",
		enableSorting: false,
		cell: (_, row) => (
			<div className="flex flex-col sm:flex-row sm:items-center justify-end sm:justify-start gap-2 w-full sm:w-auto">
				<Link
					href={`/dashboard/holidaySubsidy/declaration/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
				>
					<Button size="sm" variant="outline" className="gap-2 px-3 py-2">
						Subsidy Declaration
						<ArrowRight className="h-4 w-4" />
					</Button>
				</Link>
				<Link
					href={`/dashboard/holidaySubsidy/weekly/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
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
		<SimpleTable
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
