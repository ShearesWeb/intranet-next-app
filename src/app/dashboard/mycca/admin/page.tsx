"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useManagedCcas } from "@/features/cca/hooks/use-managed-ccas";
import type { CCAData } from "@/features/cca/types/cca-data";
import { Users, BarChart3, ArrowLeft } from "lucide-react";
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
		accessorKey: "cca_type",
		header: "Type",
		cell: (value) => <CcaTypeBadge value={String(value)} className="text-xs" />,
		enableSorting: true,
	},
	{
		accessorKey: "positions",
		header: "Managed Positions",
		cell: (_, row) => {
			const positions = row.positions ?? [];

			if (positions.length === 0) {
				return <div className="text-xs text-muted-foreground">No managed positions</div>;
			}

			return (
				<div className="flex min-w-[12rem] flex-col items-start gap-2">
					{positions.map((position) => (
						<PositionTypeBadge
							key={position.position_id}
							value={position.position_name}
							position_type={position.position_type}
							className="text-xs"
						/>
					))}
				</div>
			);
		},
		enableSorting: false,
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
				<h1 className="text-2xl font-semibold">CCA Admin</h1>
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

	const dynamicColumns: SimpleTableColumn<CCAData>[] = [
		...ccaTableColumns,
		{
			accessorKey: "actions" as keyof CCAData,
			header: "Actions",
			enableSorting: false,
			cell: (_, row) => {
				const allowManage = Boolean(row.can_manage_members);
				const allowRank = Boolean(row.can_rank_members);

				return (
					<div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
						{allowManage && (
							<Button asChild size="sm" className="gap-2">
								<Link
									href={`/dashboard/mycca/admin/manageMembers/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
								>
									<Users className="h-4 w-4" />
									Manage Members
								</Link>
							</Button>
						)}
						{allowRank && (
							<Button asChild variant="outline" size="sm" className="gap-2">
								<Link
									href={`/dashboard/mycca/admin/rankMembers/${encodeURIComponent(row.name)}?ccaId=${row.id}`}
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
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h1 className="text-2xl font-semibold">CCA Admin</h1>
				<Button asChild variant="outline" size="sm" className="gap-2">
					<Link href="/dashboard/mycca">
						<ArrowLeft className="h-4 w-4" /> Back to My CCAs
					</Link>
				</Button>
			</div>

			{ccas.length === 0 ? (
				<Card className="border-dashed bg-muted/40">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<p className="text-lg text-muted-foreground mb-2">No manageable CCAs found.</p>
						<p className="text-sm text-muted-foreground">
							You do not have admin permissions for any CCAs.
						</p>
					</CardContent>
				</Card>
			) : (
				<SimpleTable<CCAData>
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
