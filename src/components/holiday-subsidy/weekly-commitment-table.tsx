"use client";

import React, { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PositionTypeBadge } from "@/components/badges";
import { DataTable } from "@/components/table/data-table";
import { cn } from "@/lib/utils";
import type { WeeklyRow } from "@/types/weekly";

export interface WeeklyCommitmentTableProps {
	rows: WeeklyRow[];
	selected: Set<number>;
	dirtyRows?: Set<number>;
	isWeekOpen: boolean;
	onToggleSelected: (id: number) => void;
	onChange: (id: number, key: keyof WeeklyRow, value: string | number | null) => void;
}

export function WeeklyCommitmentTable({
	rows,
	selected,
	dirtyRows,
	isWeekOpen,
	onToggleSelected,
	onChange,
}: WeeklyCommitmentTableProps) {
	const columns: ColumnDef<WeeklyRow>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: () => <div className="font-semibold">Member</div>,
				cell: ({ row }) => {
					const dirty = dirtyRows?.has(row.original.id) ?? false;
					return (
						<div
							data-dirty={dirty || undefined}
							className={cn(
								"flex flex-col min-w-[180px] -my-3 -ml-5 py-3 pl-5 pr-3",
								dirty && "border-l-2 border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
							)}
						>
							<div className="flex items-center gap-1.5">
								<span className="font-semibold text-sm md:text-base leading-tight">
									{row.original.name}
								</span>
								{dirty && (
									<span
										className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
										aria-label="Unsaved changes"
									/>
								)}
							</div>
							<span className="text-xs text-muted-foreground mt-0.5">{row.original.email}</span>
						</div>
					);
				},
			},
			{
				accessorKey: "role",
				header: () => <div className="font-semibold">Role</div>,
				cell: ({ row }) => (
					<div className="min-w-[100px]">
						<PositionTypeBadge
							value={String(row.getValue("role"))}
							positionType={String(row.original.type)}
						/>
					</div>
				),
			},
			{
				accessorKey: "type",
				header: () => <div className="font-semibold">Type</div>,
				cell: ({ row }) => (
					<div className="min-w-[110px]">
						<PositionTypeBadge value={String(row.getValue("type"))} />
					</div>
				),
			},
			{
				// Per-user `hours` is now an OVERRIDE on the envelope rate.
				// Leaving the input empty inherits the envelope `approved_hours`.
				accessorKey: "hours",
				header: () => <div className="font-semibold">Hours</div>,
				cell: ({ row }) => {
					const isOverride = row.original.override_hours !== null;
					return (
						<div className="flex items-center gap-2 min-w-[100px]">
							<Input
								type="number"
								min={0}
								max={168}
								step={0.5}
								className="w-20 text-center font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
								value={isOverride ? String(row.original.override_hours) : ""}
								onClick={(e) => e.stopPropagation()}
								onMouseDown={(e) => e.stopPropagation()}
								onChange={(e) => {
									const next = e.target.value;
									onChange(row.original.id, "override_hours", next === "" ? null : Number(next));
								}}
								placeholder={String(row.original.approved_hours)}
								disabled={!row.original.has_approved_subsidy || !isWeekOpen}
								aria-label={`Hours override (envelope rate ${row.original.approved_hours})`}
							/>
							<span className="text-xs text-muted-foreground">hrs</span>
						</div>
					);
				},
			},
			{
				// Envelope-level justification is read-only here.
				accessorKey: "justification",
				header: () => <div className="font-semibold">Justification</div>,
				cell: ({ row }) => (
					<div className="min-w-[200px] max-w-[300px]">
						<p className="text-xs text-muted-foreground whitespace-pre-line break-words line-clamp-3">
							{row.original.justification || "—"}
						</p>
					</div>
				),
			},
			{
				// Per-member chair note (cca_user_subsidies.comments).
				accessorKey: "comments",
				header: () => <div className="font-semibold">Comments</div>,
				cell: ({ row }) => (
					<div className="min-w-[250px] max-w-[400px]">
						<Textarea
							className="min-h-[70px] resize-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
							value={row.original.comments}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							onChange={(e) => onChange(row.original.id, "comments", e.target.value)}
							placeholder={
								row.original.has_approved_subsidy
									? "Add a note for JCRC reviewers..."
									: "No approved subsidy"
							}
							disabled={!row.original.has_approved_subsidy || !isWeekOpen}
						/>
					</div>
				),
			},
		],
		[onChange, isWeekOpen, dirtyRows],
	);

	return (
		<DataTable<WeeklyRow, number>
			data={rows}
			columns={columns}
			selectable={isWeekOpen}
			selectedIds={selected}
			onSelectionChange={onToggleSelected}
			idField="id"
			searchColumn="name"
			searchPlaceholder="Search members by name..."
			pageSize={10}
			emptyMessage="No members with approved subsidies for this week."
			tableContainerClassName="border-muted"
		/>
	);
}
