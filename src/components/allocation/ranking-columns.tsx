import React from "react";
import { PositionTypeBadge } from "@/components/badges";
import type { OrderingTableColumn } from "@/components/table/ordering-table";
import type { RankablePosition } from "@/types/preferences";

function SlotsLeftCell({ available, capacity }: { available: number; capacity: number }) {
	const ratio = capacity > 0 ? available / capacity : 0;
	const color = ratio > 0.5 ? "text-emerald-600" : ratio > 0.2 ? "text-amber-600" : "text-red-600";
	return (
		<div className={`whitespace-nowrap font-semibold ${color}`}>
			{available} of {capacity} left
		</div>
	);
}

export const rankingColumns: OrderingTableColumn<RankablePosition>[] = [
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
		cell: (value, row) => <SlotsLeftCell available={value as number} capacity={row.capacity} />,
	},
];
