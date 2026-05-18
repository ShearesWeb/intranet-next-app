"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardContent, CardTitle, CardDescription, Card } from "@/components/ui/card";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Check, X, Info, AlertCircle } from "lucide-react";
import type { WeeklyApprovalRow } from "@/features/holiday-subsidy/types/weekly";

export interface WeeklyApprovalsTableProps {
	weekLabel: string;
	rows: WeeklyApprovalRow[];
	selected: Set<number>;
	loading: boolean;
	isLoadingData: boolean;
	error: string | null;
	onToggleSelected: (id: number) => void;
	onApprove: () => void;
	onReject: () => void;
}

export function WeeklyApprovalsTable({
	weekLabel,
	rows,
	selected,
	loading,
	isLoadingData,
	error,
	onToggleSelected,
	onApprove,
	onReject,
}: WeeklyApprovalsTableProps) {
	const columns: SelectionTableColumn<WeeklyApprovalRow>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Member",
				cell: (_value, row) => (
					<div className="flex flex-col min-w-[120px]">
						<span className="font-semibold text-sm leading-tight">{row.name}</span>
						<span className="text-xs text-muted-foreground">{row.email}</span>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: (value, row) => (
					<div className="min-w-[80px]">
						<PositionTypeBadge
							value={String(value)}
							position_type={String(row.type)}
							className="text-xs"
						/>
					</div>
				),
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: (value) => (
					<div className="min-w-[85px]">
						<PositionTypeBadge value={String(value)} className="text-xs" />
					</div>
				),
			},
			{
				accessorKey: "hours",
				header: "Hours",
				cell: (_value, row) => (
					<div className="flex items-center gap-1 min-w-[60px]">
						<span className="font-semibold text-sm">{row.hours}</span>
						<span className="text-xs text-muted-foreground">hrs</span>
					</div>
				),
			},
			{
				// Envelope-level justification (cca_subsidies.justification)
				accessorKey: "justification",
				header: "Justification",
				cell: (_value, row) => (
					<div className="min-w-[150px] max-w-[200px]">
						<p className="text-xs line-clamp-2">{row.justification || "—"}</p>
					</div>
				),
			},
			{
				// Per-member chair note (cca_user_subsidies.comments)
				accessorKey: "comments",
				header: "Comments",
				cell: (_value, row) => (
					<div className="min-w-[150px] max-w-[200px]">
						<p className="text-xs line-clamp-2">{row.comments || "—"}</p>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: (value) => {
					const status = String(value);
					const colorClass =
						status === "approved"
							? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
							: status === "rejected"
								? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
								: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";

					return (
						<div className="min-w-[75px]">
							<span
								className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}
							>
								{status}
							</span>
						</div>
					);
				},
			},
		],
		[],
	);

	return (
		<Card className="border shadow-sm">
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
					<div className="flex-1">
						<CardTitle className="text-xl">Member Commitments - {weekLabel}</CardTitle>
						<CardDescription className="flex items-center gap-2 mt-2">
							<Info className="h-4 w-4 flex-shrink-0" />
							<span>
								{selected.size > 0 ? (
									<span className="font-semibold text-foreground">
										{selected.size} member(s) selected
									</span>
								) : (
									"Select members to approve or reject their weekly commitment submissions"
								)}
							</span>
						</CardDescription>
					</div>
					<div className="flex gap-2 w-full sm:w-auto">
						<Button
							onClick={onReject}
							disabled={loading || selected.size === 0}
							variant="outline"
							size="lg"
							className="gap-2 flex-1 sm:flex-initial border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
						>
							<X className="h-4 w-4" />
							Reject Selected
						</Button>
						<Button
							onClick={onApprove}
							disabled={loading || selected.size === 0}
							size="lg"
							className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 sm:flex-initial"
						>
							<Check className="h-4 w-4" />
							Approve Selected
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isLoadingData ? (
					<div className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-2">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
							<p className="text-sm text-muted-foreground">Loading submissions...</p>
						</div>
					</div>
				) : error ? (
					<div className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-2 text-center max-w-md">
							<AlertCircle className="h-10 w-10 text-destructive" />
							<p className="text-sm font-semibold">Failed to load data</p>
							<p className="text-xs text-muted-foreground">{error}</p>
						</div>
					</div>
				) : rows.length === 0 ? (
					<div className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-2 text-center max-w-md">
							<Info className="h-10 w-10 text-muted-foreground" />
							<p className="text-sm font-semibold">No submissions yet</p>
							<p className="text-xs text-muted-foreground">
								There are no pending subsidy declarations for this week.
							</p>
						</div>
					</div>
				) : (
					<SelectionTable<WeeklyApprovalRow, number>
						data={rows}
						columns={columns}
						selectionEnabled
						selectedIds={selected}
						onSelectionChange={onToggleSelected}
						idField="id"
						searchColumn="name"
						searchPlaceholder="Search members by name..."
						pageSize={10}
						emptyMessage="No members found for this week."
						tableContainerClassName="border-muted"
						tablePadding="[&_th]:px-3 [&_td]:px-3 py-2"
					/>
				)}
			</CardContent>
		</Card>
	);
}
