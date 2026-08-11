import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CcaTypeBadge } from "@/components/badges";
import type { CCAData } from "@/types/cca-data";

export const ccaNameColumn: ColumnDef<CCAData> = {
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
};

export const ccaKindColumn: ColumnDef<CCAData> = {
	accessorKey: "cca_kind",
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
	cell: ({ row }) => <CcaTypeBadge value={String(row.getValue("cca_kind"))} className="text-xs" />,
};
