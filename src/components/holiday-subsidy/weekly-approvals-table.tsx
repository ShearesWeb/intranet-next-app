"use client";

import React, { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PositionTypeBadge } from "@/components/badges";
import { StatusPill } from "@/components/shared/status-pill";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Check, X, Info, AlertCircle } from "lucide-react";
import type { WeeklyApprovalRow, WeeklyApprovalStatus } from "@/types/weekly";

export interface WeeklyApprovalsTableProps {
	weekLabel: string;
	rows: WeeklyApprovalRow[];
	selected: Set<number>;
	pendingStatus: Map<number, WeeklyApprovalStatus>;
	saving: boolean;
	isLoadingData: boolean;
	error: string | null;
	onToggleSelected: (id: number) => void;
	onStageApprove: () => void;
	onStageReject: () => void;
}

function statusClass(status: string): string {
	return status === "approved"
		? "bg-emerald-100 text-emerald-800"
		: status === "rejected"
			? "bg-red-100 text-red-800"
			: "bg-amber-100 text-amber-800";
}

export function WeeklyApprovalsTable({
	weekLabel,
	rows,
	selected,
	pendingStatus,
	saving,
	isLoadingData,
	error,
	onToggleSelected,
	onStageApprove,
	onStageReject,
}: WeeklyApprovalsTableProps) {
	const columns: ColumnDef<WeeklyApprovalRow>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: () => <div className="font-semibold">Member</div>,
				cell: ({ row }) => {
					const staged = pendingStatus.has(row.original.id);
					return (
						<div
							data-staged={staged || undefined}
							className={cn(
								"flex flex-col min-w-[120px] -my-2 -ml-3 py-2 pl-3 pr-2",
								staged && "border-l-2 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
							)}
						>
							<div className="flex items-center gap-1.5">
								<span className="font-semibold text-sm leading-tight">{row.original.name}</span>
								{staged && (
									<span
										className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
										aria-label="Staged change"
									/>
								)}
							</div>
							<span className="text-xs text-muted-foreground">{row.original.email}</span>
						</div>
					);
				},
			},
			{
				accessorKey: "role",
				header: () => <div className="font-semibold">Role</div>,
				cell: ({ row }) => (
					<div className="min-w-[80px]">
						<PositionTypeBadge
							value={String(row.getValue("role"))}
							positionType={String(row.original.type)}
							className="text-xs"
						/>
					</div>
				),
			},
			{
				accessorKey: "type",
				header: () => <div className="font-semibold">Type</div>,
				cell: ({ row }) => (
					<div className="min-w-[85px]">
						<PositionTypeBadge value={String(row.getValue("type"))} className="text-xs" />
					</div>
				),
			},
			{
				accessorKey: "hours",
				header: () => <div className="font-semibold">Hours</div>,
				cell: ({ row }) => (
					<div className="flex items-center gap-1 min-w-[60px]">
						<span className="font-semibold text-sm">{row.original.hours}</span>
						<span className="text-xs text-muted-foreground">hrs</span>
					</div>
				),
			},
			{
				accessorKey: "justification",
				header: () => <div className="font-semibold">Justification</div>,
				cell: ({ row }) => (
					<div className="min-w-[150px] max-w-[200px]">
						<p className="text-xs line-clamp-2">{row.original.justification || "—"}</p>
					</div>
				),
			},
			{
				accessorKey: "comments",
				header: () => <div className="font-semibold">Comments</div>,
				cell: ({ row }) => (
					<div className="min-w-[150px] max-w-[200px]">
						<p className="text-xs line-clamp-2">{row.original.comments || "—"}</p>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: () => <div className="font-semibold">Status</div>,
				cell: ({ row }) => {
					const staged = pendingStatus.get(row.original.id);
					return (
						<div className="flex flex-col gap-1 min-w-[110px]">
							<StatusPill
								label={String(row.getValue("status"))}
								className={statusClass(String(row.getValue("status")))}
								capitalize
							/>
							{staged && (
								<div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
									<span>{"→"}</span>
									<StatusPill label={staged} className={statusClass(staged)} capitalize />
								</div>
							)}
						</div>
					);
				},
			},
		],
		[pendingStatus],
	);

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">Member commitments &mdash; {weekLabel}</h2>
					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Info className="h-4 w-4 flex-shrink-0" />
						<span>
							{selected.size > 0 ? (
								<span className="font-medium text-foreground">
									{selected.size} member{selected.size === 1 ? "" : "s"} selected
								</span>
							) : (
								"Select members, then stage an approve or reject decision."
							)}
						</span>
					</div>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={onStageReject}
						disabled={saving || selected.size === 0}
						variant="destructive"
						size="sm"
						className="gap-2"
					>
						<X className="h-4 w-4" />
						Reject selected
					</Button>
					<Button
						onClick={onStageApprove}
						disabled={saving || selected.size === 0}
						size="sm"
						className="gap-2"
					>
						<Check className="h-4 w-4" />
						Approve selected
					</Button>
				</div>
			</div>

			{isLoadingData ? (
				<div className="flex items-center justify-center py-12">
					<div className="flex flex-col items-center gap-2">
						<Spinner className="h-8 w-8 text-primary" />
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
							There are no weekly subsidy submissions for this week.
						</p>
					</div>
				</div>
			) : (
				<DataTable<WeeklyApprovalRow, number>
					data={rows}
					columns={columns}
					selectable
					selectedIds={selected}
					onSelectionChange={onToggleSelected}
					idField="id"
					searchColumn="name"
					searchPlaceholder="Search members by name..."
					pageSize={10}
					emptyMessage="No members found for this week."
					tablePadding="[&_th]:px-3 [&_td]:px-3 py-2"
				/>
			)}
		</section>
	);
}
