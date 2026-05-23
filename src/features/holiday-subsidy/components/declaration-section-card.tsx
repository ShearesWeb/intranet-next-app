"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { PositionTypeBadge } from "@/components/badges";
import { DataTable } from "@/components/table/data-table";
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

	const commonColumns = useMemo<ColumnDef<SubsidyDeclaration>[]>(
		() => [
			{
				accessorKey: "positionName",
				header: () => <div className="font-semibold">Position</div>,
				enableSorting: false,
				cell: ({ row }) => (
					<PositionTypeBadge
						value={String(row.getValue("positionName"))}
						positionType={row.original.positionType}
					/>
				),
			},
			{
				accessorKey: "weekId",
				header: ({ column }) => (
					<div className="flex items-center gap-2">
						<span className="font-semibold">Week</span>
						<Button
							variant="ghost"
							onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
							className="h-8 w-8 p-0"
						>
							<span className="sr-only">Sort</span>
						</Button>
					</div>
				),
				cell: ({ row }) => weekLabel(Number(row.getValue("weekId"))),
			},
			{
				accessorKey: "hours",
				header: ({ column }) => (
					<div className="flex items-center gap-2">
						<span className="font-semibold">Requested Hours</span>
						<Button
							variant="ghost"
							onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
							className="h-8 w-8 p-0"
						>
							<span className="sr-only">Sort</span>
						</Button>
					</div>
				),
				cell: ({ row }) => `${Number(row.getValue("hours"))} hrs`,
			},
			{
				accessorKey: "justification",
				header: () => <div className="font-semibold">Justification</div>,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="text-sm text-muted-foreground whitespace-pre-line break-words max-w-[320px] max-h-32 overflow-y-auto pr-1 line-clamp-3">
						{String(row.getValue("justification") ?? "")}
					</div>
				),
			},
			{
				accessorKey: "status",
				header: () => <div className="font-semibold">Status</div>,
				enableSorting: false,
				cell: ({ row }) => {
					const status = coerceSubsidyStatus(row.getValue("status"));
					return <Badge variant={statusVariant[status]}>{formatSubsidyStatus(status)}</Badge>;
				},
			},
		],
		[weekLabel],
	);

	const columns = useMemo<ColumnDef<SubsidyDeclaration>[]>(() => {
		if (renderActions) {
			return [
				...commonColumns,
				{
					id: "actions",
					header: () => <div className="font-semibold">Actions</div>,
					enableSorting: false,
					cell: ({ row }) => (
						<div className="flex justify-start gap-2">{renderActions(row.original)}</div>
					),
				},
			];
		}

		if (section.key === SubsidyStatus.PENDING) {
			return [
				...commonColumns,
				{
					id: "actions",
					header: () => <div className="font-semibold">Actions</div>,
					enableSorting: false,
					cell: ({ row }) => (
						<div className="flex justify-start gap-2">
							<Button variant="outline" size="sm" type="button" onClick={() => onEdit?.(row.original)}>
								Edit
							</Button>
							<Button variant="destructive" size="sm" type="button" onClick={() => onDelete?.(row.original)}>
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
					id: "actions",
					header: () => <div className="font-semibold">Actions</div>,
					enableSorting: false,
					cell: ({ row }) => (
						<div className="flex justify-start gap-2">
							<Button size="sm" type="button" onClick={() => onEdit?.(row.original)}>
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
				<DataTable
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
