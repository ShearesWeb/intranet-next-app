"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useCcaList } from "@/features/cca/hooks/use-cca-list";
import type { CCAData } from "@/features/cca/types/cca-data";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { CcaTypeBadge } from "@/components/badges/cca-type-badge";

const ccaTableColumns: SimpleTableColumn<CCAData>[] = [
	{
		accessorKey: "name",
		header: "CCA",
		cell: (value, row) => (
			<div className="flex flex-col gap-2 pr-4">
				<strong className="font-semibold text-sm md:text-base">{String(value)}</strong>
				{row.description && (
					<div className="text-xs md:text-sm text-muted-foreground break-words whitespace-normal text-justify leading-relaxed line-clamp-5">
						{row.description}
					</div>
				)}
			</div>
		),
	},
	{
		accessorKey: "role",
		header: "Role",
		cell: (value, row) => (
			<PositionTypeBadge
				value={String(value)}
				position_type={String(row.position_type || "")}
				className="text-xs"
			/>
		),
		enableSorting: true,
	},
	{
		accessorKey: "cca_type",
		header: "Type",
		cell: (value) => <CcaTypeBadge value={String(value)} className="text-xs" />,
		enableSorting: true,
	},
	{
		accessorKey: "points",
		header: "Points",
		cell: (value) => (
			<div className="font-semibold text-center text-sm md:text-base">{String(value)}</div>
		),
		enableSorting: true,
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
				<h1 className="text-2xl font-semibold">My CCAs</h1>
				<Card className="border-destructive/40 bg-destructive/5">
					<CardContent className="flex flex-col items-center gap-4 p-6">
						<p className="text-destructive font-medium text-center">{error}</p>
						<Button onClick={() => window.location.reload()} variant="default">
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<h1 className="text-2xl font-semibold">My CCAs</h1>

			{ccas.length === 0 ? (
				<Card className="border-dashed bg-muted/40">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<p className="text-lg text-muted-foreground mb-2">No CCA appointments found.</p>
						<p className="text-sm text-muted-foreground">
							You have not been assigned to any CCAs yet. Check back later or contact your CCA
							chairs/ICs.
						</p>
					</CardContent>
				</Card>
			) : (
				<SimpleTable<CCAData>
					data={ccas}
					columns={ccaTableColumns}
					pageSize={10}
					emptyMessage="No CCAs found"
				/>
			)}
		</div>
	);
}
