import React from "react";
import { PositionTypeBadge } from "@/components/badges";
import type { DataTableColumnDef } from "@/components/table/data-table";
import type { OrderingTableColumn } from "@/components/table/ordering-table";
import type { RankablePosition } from "@/types/preferences";

// Used by RankSelectionStep (DataTable with checkboxes)
export const rankingColumns: DataTableColumnDef<RankablePosition>[] = [
	{
		accessorKey: "name",
		header: "Position",
		cell: ({ getValue }) => <div className="font-medium">{String(getValue())}</div>,
	},
	{ accessorKey: "cca_name", header: "CCA" },
	{
		accessorKey: "position_type",
		header: "Commitment",
		cell: ({ getValue }) => <PositionTypeBadge value={String(getValue())} />,
	},
	{
		accessorKey: "available_capacity",
		header: "Slots left",
		cell: ({ getValue, row }) => (
			<div className="whitespace-nowrap text-muted-foreground">
				{getValue() as number}/{row.original.capacity} available
			</div>
		),
	},
];

// Used by RankOrderingStep (OrderingTable with drag-and-drop)
export const rankingOrderingColumns: OrderingTableColumn<RankablePosition>[] = [
	{
		accessorKey: "name",
		header: "Position",
		cell: (value) => <div className="font-medium">{String(value)}</div>,
	},
	{ accessorKey: "cca_name", header: "CCA" },
	{
		accessorKey: "position_type",
		header: "Commitment",
		cell: (value) => <PositionTypeBadge value={String(value)} />,
	},
	{
		accessorKey: "available_capacity",
		header: "Slots left",
		cell: (value, row) => (
			<div className="whitespace-nowrap text-muted-foreground">
				{value as number}/{row.capacity} available
			</div>
		),
	},
];
