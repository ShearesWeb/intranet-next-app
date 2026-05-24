"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ShieldCheck, ListChecks, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/table/data-table";
import type { CcaApprovalRow } from "@/hooks/use-subsidy-approvals-index";

const columns: ColumnDef<CcaApprovalRow>[] = [
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
			<span className="font-semibold text-sm md:text-base">{String(row.getValue("name"))}</span>
		),
	},
	{
		accessorKey: "pendingDeclarations",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">Pending Declarations</span>
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
			<span className="text-sm md:text-base font-medium">
				{Number(row.getValue("pendingDeclarations"))}
			</span>
		),
	},
	{
		accessorKey: "pendingWeekly",
		header: ({ column }) => (
			<div className="flex items-center gap-2">
				<span className="font-semibold">Pending Weekly Commitments</span>
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
			<span className="text-sm md:text-base font-medium">
				{Number(row.getValue("pendingWeekly"))}
			</span>
		),
	},
	{
		id: "actions",
		header: () => <div className="font-semibold">Actions</div>,
		enableSorting: false,
		cell: ({ row }) => (
			<div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
				<Button asChild variant="outline" size="sm" className="gap-2">
					<Link
						href={`/dashboard/holiday-subsidy/approvals/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
					>
						Approve pending declarations
						<ListChecks className="h-4 w-4" />
					</Link>
				</Button>
				<Button asChild size="sm" className="gap-2">
					<Link
						href={`/dashboard/holiday-subsidy/approvals/weekly/${encodeURIComponent(row.original.name)}?ccaId=${row.original.id}`}
					>
						Approve pending weekly commitments
						<ShieldCheck className="h-4 w-4" />
					</Link>
				</Button>
			</div>
		),
	},
];

interface ApprovalCcaTableProps {
	rows: CcaApprovalRow[];
	error: string | null;
}

export function ApprovalCcaTable({ rows, error }: ApprovalCcaTableProps) {
	if (error) {
		return (
			<Card>
				<CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
			</Card>
		);
	}
	return (
		<DataTable
			data={rows}
			columns={columns}
			searchColumn="name"
			searchPlaceholder="Search CCA..."
			pageSize={10}
			emptyMessage="No CCAs available."
			tableContainerClassName="rounded-lg border bg-card/40 overflow-hidden"
			tableClassName="min-w-full [&_th]:px-5 [&_td]:px-5"
		/>
	);
}
