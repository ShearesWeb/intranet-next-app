"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	DeclarationSection,
	SubsidyDeclaration,
	WeekOption,
} from "@/features/holiday-subsidy/types/declarations";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";
import {
	coerceSubsidyStatus,
	formatSubsidyStatus,
} from "@/features/holiday-subsidy/utils/declaration-mappers";

const statusVariant: Record<SubsidyStatus, "default" | "secondary" | "destructive"> = {
	[SubsidyStatus.PENDING]: "secondary",
	[SubsidyStatus.APPROVED]: "default",
	[SubsidyStatus.REJECTED]: "destructive",
};

export interface DeclarationSectionCardProps {
	section: DeclarationSection;
	weekOptions: WeekOption[];
	onEdit?: (declaration: SubsidyDeclaration) => void;
	onDelete?: (declaration: SubsidyDeclaration) => void;
	/**
	 * Optional custom renderer for the per-row actions cell. When provided, this
	 * replaces the default Edit / Delete / Edit & Resubmit buttons and allows
	 * callers (such as the JCRC approvals view) to render their own controls.
	 */
	renderActions?: (declaration: SubsidyDeclaration) => ReactNode;
	/**
	 * Optional element rendered in the card header alongside the title (e.g. an
	 * "Unsaved changes" indicator for the approvals flow).
	 */
	headerExtra?: ReactNode;
}

export function DeclarationSectionCard({
	section,
	weekOptions,
	onEdit,
	onDelete,
	renderActions,
	headerExtra,
}: DeclarationSectionCardProps) {
	const weekLabel = useCallback(
		(weekId: number) => {
			const week = weekOptions.find((w) => w.id === weekId);
			return week?.label || `Week ${weekId}`;
		},
		[weekOptions],
	);

	const commonColumns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(
		() => [
			{
				accessorKey: "positionName",
				header: "Position",
				cell: (value, row) => (
					<PositionTypeBadge value={String(value)} position_type={row.positionType} />
				),
				enableSorting: false,
			},
			{
				accessorKey: "weekId",
				header: "Week",
				cell: (value) => weekLabel(Number(value)),
				enableSorting: true,
			},
			{
				accessorKey: "hours",
				header: "Requested Hours",
				cell: (value) => `${Number(value)} hrs`,
				enableSorting: true,
			},
			{
				accessorKey: "justification",
				header: "Justification",
				cell: (value) => (
					<div className="text-sm text-muted-foreground whitespace-pre-line break-words max-w-[320px] max-h-32 overflow-y-auto pr-1 line-clamp-3">
						{String(value ?? "")}
					</div>
				),
				enableSorting: false,
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: (value) => {
					const status = coerceSubsidyStatus(value);
					return <Badge variant={statusVariant[status]}>{formatSubsidyStatus(status)}</Badge>;
				},
				enableSorting: false,
			},
		],
		[weekLabel],
	);

	const columns = useMemo<SimpleTableColumn<SubsidyDeclaration>[]>(() => {
		if (renderActions) {
			return [
				...commonColumns,
				{
					accessorKey: "actions" as keyof SubsidyDeclaration,
					header: "Actions",
					enableSorting: false,
					cell: (_value, row) => (
						<div className="flex justify-start gap-2">{renderActions(row)}</div>
					),
				},
			];
		}

		if (section.key === SubsidyStatus.PENDING) {
			return [
				...commonColumns,
				{
					accessorKey: "actions" as keyof SubsidyDeclaration,
					header: "Actions",
					enableSorting: false,
					cell: (_value, row) => (
						<div className="flex justify-start gap-2">
							<Button variant="outline" size="sm" type="button" onClick={() => onEdit?.(row)}>
								Edit
							</Button>
							<Button variant="destructive" size="sm" type="button" onClick={() => onDelete?.(row)}>
								Delete
							</Button>
						</div>
					),
				},
			];
		}

		if (section.key === SubsidyStatus.REJECTED || section.key === SubsidyStatus.APPROVED) {
			return [
				...commonColumns,
				{
					accessorKey: "actions" as keyof SubsidyDeclaration,
					header: "Actions",
					enableSorting: false,
					cell: (_value, row) => (
						<div className="flex justify-start gap-2">
							<Button size="sm" type="button" onClick={() => onEdit?.(row)}>
								Edit & Resubmit
							</Button>
						</div>
					),
				},
			];
		}

		return commonColumns;
	}, [commonColumns, onDelete, onEdit, renderActions, section.key]);

	return (
		<Card className="border shadow-sm">
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>{section.title}</CardTitle>
				{headerExtra}
			</CardHeader>
			<CardContent>
				<SimpleTable
					data={section.data}
					columns={columns}
					searchColumn="positionName"
					searchPlaceholder="Search position..."
					pageSize={10}
					emptyMessage="No declarations found."
					tableContainerClassName="rounded-md border bg-card/30 overflow-hidden"
					tableClassName="[&_th]:px-5 [&_td]:px-5"
				/>
			</CardContent>
		</Card>
	);
}
