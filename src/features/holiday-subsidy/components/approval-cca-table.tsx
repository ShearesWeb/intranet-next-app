"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import type { CcaApprovalRow } from "@/features/holiday-subsidy/hooks/use-subsidy-approvals-index";

const columns: SimpleTableColumn<CcaApprovalRow>[] = [
	{
		accessorKey: "name",
		header: "CCA",
		cell: (value) => <span className="font-semibold text-sm md:text-base">{String(value)}</span>,
	},
	{
		accessorKey: "pendingDeclarations",
		header: "Pending Declarations",
		cell: (value) => <span className="text-sm md:text-base font-medium">{Number(value)}</span>,
	},
	{
		accessorKey: "pendingWeekly",
		header: "Pending Weekly Commitments",
		cell: (value) => <span className="text-sm md:text-base font-medium">{Number(value)}</span>,
	},
	{
		accessorKey: "actions" as keyof CcaApprovalRow,
		header: "Actions",
		enableSorting: false,
		cell: (_value, row) => (
			<div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
				<Button asChild variant="outline" size="sm" className="gap-2">
					<Link
						href={`/dashboard/holidaySubsidy/approvals/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
					>
						Approve pending declarations
						<ListChecks className="h-4 w-4" />
					</Link>
				</Button>
				<Button asChild size="sm" className="gap-2">
					<Link
						href={`/dashboard/holidaySubsidy/approvals/weekly/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
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
		<SimpleTable
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
