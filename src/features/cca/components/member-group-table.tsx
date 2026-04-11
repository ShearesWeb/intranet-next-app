"use client";

import React from "react";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { SimpleTable, type SimpleTableColumn } from "@/components/table/simple-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CommitmentPeriod, CutStatus, Member } from "@/features/cca/types/members";
import {
	CULTURE_STATUS_OPTIONS,
	formatCommitmentPeriod,
	SPORTS_STATUS_OPTIONS,
} from "@/features/cca/utils/member-helpers";
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

const memberTableColumns: SimpleTableColumn<Member>[] = [
	{ accessorKey: "name", header: "Name" },
	{ accessorKey: "email", header: "Email" },
	{ accessorKey: "room", header: "Room" },
	{
		accessorKey: "position_name",
		header: "Position",
		cell: (value, row) => (
			<PositionTypeBadge
				value={String(value)}
				position_type={String(row.position_type || "")}
				className="text-xs"
			/>
		),
	},
];

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
	if (members.length === 0 && !showActions && !showAddButton) {
		return null;
	}

	const isSports = ccaType === "sports";
	const isCulture = ccaType === "culture";
	const isSportsCulture = isSports || isCulture;
	const showEditableCommitment = canManage && !isSports;

	const columnsToUse: SimpleTableColumn<Member>[] =
		showActions && canManage
			? [
					...memberTableColumns,
					{
						accessorKey: "commitment_period",
						header: "Commitment",
						cell: (value, row) =>
							showEditableCommitment ? (
								<select
									value={(typeof value === "string" ? value : null) || "full-year"}
									onChange={(e) =>
										onUpdateCommitment(row.user_id, e.target.value as CommitmentPeriod)
									}
									className="border rounded p-1 text-sm bg-transparent cursor-pointer hover:bg-gray-100 w-28"
									onClick={(e) => e.stopPropagation()}
								>
									<option value="full-year">Full Year</option>
									<option value="semester-1">Semester 1</option>
									<option value="semester-2">Semester 2</option>
								</select>
							) : (
								<span>
									{formatCommitmentPeriod(value as CommitmentPeriod | null | undefined)}
								</span>
							),
					},
					{
						accessorKey: "appointed_date",
						header: "Actions",
						cell: (_value, row) => (
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
											{row.cut_status && (
												<DropdownMenuItem onClick={() => onUpdateStatus(row.user_id, row.name, null)}>
													Move to Members
												</DropdownMenuItem>
											)}
											{SPORTS_STATUS_OPTIONS.filter(
												(option) => option.status !== row.cut_status,
											).map((option) => (
												<DropdownMenuItem
													key={option.status}
													onClick={() => onUpdateStatus(row.user_id, row.name, option.status)}
												>
													{option.label}
												</DropdownMenuItem>
											))}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={() => onRemoveMember(row.user_id, row.name)}
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
											{row.cut_status ? (
												<DropdownMenuItem onClick={() => onUpdateStatus(row.user_id, row.name, null)}>
													Move to Members
												</DropdownMenuItem>
											) : null}
											{CULTURE_STATUS_OPTIONS.filter(
												(option) => option.status !== row.cut_status,
											).map((option) => (
												<DropdownMenuItem
													key={option.status}
													onClick={() => onUpdateStatus(row.user_id, row.name, option.status)}
												>
													{option.label}
												</DropdownMenuItem>
											))}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={() => onRemoveMember(row.user_id, row.name)}
												className="text-red-600"
											>
												Remove Member
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								) : (
									<Button
										size="sm"
										onClick={() => onRemoveMember(row.user_id, row.name)}
										className="bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
									>
										Remove
									</Button>
								)}
							</div>
						),
						enableSorting: false,
					},
				]
			: [
					...memberTableColumns,
					{
						accessorKey: "commitment_period",
						header: "Commitment",
						cell: (value) => (
							<span>{formatCommitmentPeriod(value as CommitmentPeriod | null | undefined)}</span>
						),
					},
				];

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
				<div className="p-4 border border-dashed border-gray-300 rounded-md text-gray-500">
					No {title.toLowerCase()} found.
				</div>
			) : (
				<SimpleTable<Member>
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
