"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { PositionTypeBadge } from "@/components/badges";
import { DataTable } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CommitmentPeriod, CutStatus, Member } from "@/types/members";
import {
	CULTURE_STATUS_OPTIONS,
	formatCommitmentPeriod,
	SPORTS_STATUS_OPTIONS,
} from "@/lib/cca/member-helpers";
import { MoreHorizontal } from "lucide-react";

interface MemberGroupTableProps {
	title: string;
	members: Member[];
	canManage: boolean;
	ccaType: string;
	onRemoveMember: (userId: number, name: string) => void;
	onUpdateStatus: (userId: number, name: string, status: CutStatus | null) => void;
	onUpdateCommitment: (userId: number, period: CommitmentPeriod) => void;
	onAddMember?: () => void;
	showActions?: boolean;
	showAddButton?: boolean;
}

function buildMemberColumns(
	showActions: boolean,
	canManage: boolean,
	ccaType: string,
	onRemoveMember: (userId: number, name: string) => void,
	onUpdateStatus: (userId: number, name: string, status: CutStatus | null) => void,
	onUpdateCommitment: (userId: number, period: CommitmentPeriod) => void,
): ColumnDef<Member>[] {
	const isSports = ccaType === "sports";
	const isCulture = ccaType === "culture";
	const showEditableCommitment = canManage && !isSports;

	const baseColumns: ColumnDef<Member>[] = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<div className="flex items-center gap-2">
					<span className="font-semibold">Name</span>
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 w-8 p-0"
					>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>
			),
		},
		{
			accessorKey: "email",
			header: ({ column }) => (
				<div className="flex items-center gap-2">
					<span className="font-semibold">Email</span>
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 w-8 p-0"
					>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>
			),
		},
		{
			accessorKey: "room",
			header: ({ column }) => (
				<div className="flex items-center gap-2">
					<span className="font-semibold">Room</span>
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 w-8 p-0"
					>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>
			),
		},
		{
			accessorKey: "position_name",
			header: ({ column }) => (
				<div className="flex items-center gap-2">
					<span className="font-semibold">Position</span>
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
				<PositionTypeBadge
					value={String(row.getValue("position_name"))}
					positionType={String(row.original.position_type || "")}
					className="text-xs"
				/>
			),
		},
	];

	if (showActions && canManage) {
		return [
			...baseColumns,
			{
				accessorKey: "commitment_period",
				header: () => <div className="font-semibold">Commitment</div>,
				enableSorting: false,
				cell: ({ row }) =>
					showEditableCommitment ? (
						<select
							value={
								(typeof row.original.commitment_period === "string"
									? row.original.commitment_period
									: null) || "full-year"
							}
							onChange={(e) =>
								onUpdateCommitment(row.original.user_id, e.target.value as CommitmentPeriod)
							}
							className="h-9 w-28 px-3 border rounded-md bg-transparent text-sm cursor-pointer transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60"
							onClick={(e) => e.stopPropagation()}
						>
							<option value="full-year">Full Year</option>
							<option value="semester-1">Semester 1</option>
							<option value="semester-2">Semester 2</option>
						</select>
					) : (
						<span>
							{formatCommitmentPeriod(
								row.original.commitment_period as CommitmentPeriod | null | undefined,
							)}
						</span>
					),
			},
			{
				id: "actions",
				header: () => <div className="font-semibold">Actions</div>,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-3">
						{isSports ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="h-8 w-8 p-0">
										<span className="sr-only">Open menu</span>
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{row.original.cut_status && (
										<DropdownMenuItem
											onClick={() => onUpdateStatus(row.original.user_id, row.original.name, null)}
										>
											Move to Members
										</DropdownMenuItem>
									)}
									{SPORTS_STATUS_OPTIONS.filter(
										(option) => option.status !== row.original.cut_status,
									).map((option) => (
										<DropdownMenuItem
											key={option.status}
											onClick={() =>
												onUpdateStatus(row.original.user_id, row.original.name, option.status)
											}
										>
											{option.label}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => onRemoveMember(row.original.user_id, row.original.name)}
										className="text-red-600"
									>
										Remove Member
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : isCulture ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="h-8 w-8 p-0">
										<span className="sr-only">Open menu</span>
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{row.original.cut_status ? (
										<DropdownMenuItem
											onClick={() => onUpdateStatus(row.original.user_id, row.original.name, null)}
										>
											Move to Members
										</DropdownMenuItem>
									) : null}
									{CULTURE_STATUS_OPTIONS.filter(
										(option) => option.status !== row.original.cut_status,
									).map((option) => (
										<DropdownMenuItem
											key={option.status}
											onClick={() =>
												onUpdateStatus(row.original.user_id, row.original.name, option.status)
											}
										>
											{option.label}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => onRemoveMember(row.original.user_id, row.original.name)}
										className="text-red-600"
									>
										Remove Member
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => onRemoveMember(row.original.user_id, row.original.name)}
							>
								Remove
							</Button>
						)}
					</div>
				),
			},
		];
	}

	return [
		...baseColumns,
		{
			accessorKey: "commitment_period",
			header: () => <div className="font-semibold">Commitment</div>,
			enableSorting: false,
			cell: ({ row }) => (
				<span>
					{formatCommitmentPeriod(
						row.original.commitment_period as CommitmentPeriod | null | undefined,
					)}
				</span>
			),
		},
	];
}

export function MemberGroupTable({
	title,
	members,
	canManage,
	ccaType,
	onRemoveMember,
	onUpdateStatus,
	onUpdateCommitment,
	onAddMember,
	showActions = false,
	showAddButton = false,
}: MemberGroupTableProps) {
	const isSports = ccaType === "sports";
	const isCulture = ccaType === "culture";
	const isSportsCulture = isSports || isCulture;

	const columnsToUse = React.useMemo(
		() =>
			buildMemberColumns(
				showActions,
				canManage,
				ccaType,
				onRemoveMember,
				onUpdateStatus,
				onUpdateCommitment,
			),
		[showActions, canManage, ccaType, onRemoveMember, onUpdateStatus, onUpdateCommitment],
	);

	if (members.length === 0 && !showActions && !showAddButton) {
		return null;
	}

	return (
		<div className="mb-8">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
				<h3 className="text-xl font-semibold">{title}</h3>
				{canManage && showAddButton && isSportsCulture && onAddMember && (
					<Button
						onClick={onAddMember}
						size="sm"
						className="bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
					>
						+ Add Member
					</Button>
				)}
			</div>

			{members.length === 0 ? (
				<div className="p-4 border border-dashed rounded-md text-muted-foreground">
					No {title.toLowerCase()} found.
				</div>
			) : (
				<DataTable<Member>
					searchColumn="name"
					data={members}
					columns={columnsToUse}
					pageSize={8}
					emptyMessage="No members"
				/>
			)}
		</div>
	);
}
