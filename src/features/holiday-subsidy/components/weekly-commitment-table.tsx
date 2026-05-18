"use client";

import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { SelectionTable, type SelectionTableColumn } from "@/components/table/selection-table";
import type { WeeklyRow } from "@/features/holiday-subsidy/types/weekly";

export interface WeeklyCommitmentTableProps {
	rows: WeeklyRow[];
	selected: Set<number>;
	isWeekOpen: boolean;
	onToggleSelected: (id: number) => void;
	onChange: (id: number, key: keyof WeeklyRow, value: string | number | null) => void;
}

export function WeeklyCommitmentTable({
	rows,
	selected,
	isWeekOpen,
	onToggleSelected,
	onChange,
}: WeeklyCommitmentTableProps) {
	const columns: SelectionTableColumn<WeeklyRow>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Member",
				cell: (_value, row) => (
					<div className="flex flex-col min-w-[180px]">
						<span className="font-semibold text-sm md:text-base leading-tight">{row.name}</span>
						<span className="text-xs text-muted-foreground mt-0.5">{row.email}</span>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: (value, row) => (
					<div className="min-w-[100px]">
						<PositionTypeBadge value={String(value)} position_type={String(row.type)} />
					</div>
				),
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: (value) => (
					<div className="min-w-[110px]">
						<PositionTypeBadge value={String(value)} />
					</div>
				),
			},
			{
				// Per-user `hours` is now an OVERRIDE on the envelope rate.
				// Leaving the input empty inherits the envelope `approved_hours`.
				accessorKey: "hours",
				header: "Hours",
				cell: (_value, row) => {
					const isOverride = row.override_hours !== null;
					return (
						<div className="flex items-center gap-2 min-w-[100px]">
							<Input
								type="number"
								min={0}
								max={168}
								step={0.5}
								className="w-20 text-center font-semibold"
								value={isOverride ? String(row.override_hours) : ""}
								onClick={(e) => e.stopPropagation()}
								onMouseDown={(e) => e.stopPropagation()}
								onChange={(e) => {
									const next = e.target.value;
									onChange(row.id, "override_hours", next === "" ? null : Number(next));
								}}
								placeholder={String(row.approved_hours)}
								disabled={!row.has_approved_subsidy || !isWeekOpen}
								aria-label={`Hours override (envelope rate ${row.approved_hours})`}
							/>
							<span className="text-xs text-muted-foreground">hrs</span>
						</div>
					);
				},
			},
			{
				// Envelope-level justification is read-only here — it lives on
				// the parent cca_subsidies row, set by the chair at envelope
				// declaration time.
				accessorKey: "justification",
				header: "Justification",
				cell: (_value, row) => (
					<div className="min-w-[200px] max-w-[300px]">
						<p className="text-xs text-muted-foreground whitespace-pre-line break-words line-clamp-3">
							{row.justification || "—"}
						</p>
					</div>
				),
			},
			{
				// Per-member chair note (cca_user_subsidies.comments).
				accessorKey: "comments",
				header: "Comments",
				cell: (_value, row) => (
					<div className="min-w-[250px] max-w-[400px]">
						<Textarea
							className="min-h-[70px] resize-none text-sm"
							value={row.comments}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							onChange={(e) => onChange(row.id, "comments", e.target.value)}
							placeholder={
								row.has_approved_subsidy
									? "Add a note for JCRC reviewers..."
									: "No approved subsidy"
							}
							disabled={!row.has_approved_subsidy || !isWeekOpen}
						/>
					</div>
				),
			},
		],
		[onChange, isWeekOpen],
	);

	return (
		<SelectionTable<WeeklyRow, number>
			data={rows}
			columns={columns}
			selectionEnabled={isWeekOpen}
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
