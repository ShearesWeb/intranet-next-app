// src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Member, UserSearchResult, CommitmentPeriod } from "@/features/cca/types/members";
import { useCcaMembers } from "@/features/cca/hooks/use-cca-members";

// shadcn UI
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft, Volleyball, MoreHorizontal } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import {
	CULTURE_STATUS_OPTIONS,
	formatCommitmentPeriod,
	isChairPositionType,
	SPORTS_STATUS_OPTIONS,
} from "@/features/cca/utils/member-helpers";

// Custom table component
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import Link from "next/link";

// Define member table columns
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


export default function ManageMembersPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const ccaId = searchParams.get("ccaId");
	const {
		groupedMembers,
		cca,
		permissions,
		allPositions,
		loading,
		error,
		saving,
		saveErrors,
		setSaveErrors,
		pendingChanges,
		searchQuery,
		setSearchQuery,
		searchResults,
		searchLoading,
		searchUser,
		addMember,
		removeMember,
		updateStatus,
		updateCommitment,
		saveAll,
	} = useCcaMembers(ccaId);

	// Modal state
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
	const [addForm, setAddForm] = useState<{
		positionId: number;
		commitmentPeriod: CommitmentPeriod | "";
	}>({
		positionId: 0,
		commitmentPeriod: "",
	});

	const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			void searchUser();
		}
	};

	// Check if user is already added (locally or originally)
	const isUserAdded = (userId: number) => {
		const allCurrentMembers = Object.values(groupedMembers).flat() as Member[];
		return allCurrentMembers.some((member) => member.user_id === userId);
	};

	// Get button text for user in search results
	const getUserButtonText = (userId: number) => {
		return isUserAdded(userId) ? "Remove" : "Add";
	};

	// Handle adding/removing user from search results
	const handleUserButtonClick = (user: UserSearchResult) => {
		if (isUserAdded(user.id)) {
			removeMember(user.id, user.name);
			return;
		}
		addMember(user.id, user.name, user.email, user.room || "");
	};

	if (loading) {
		return (
			<AppLayout>
				<LoadingSpinner message="Loading members..." />
			</AppLayout>
		);
	}

	if (error) {
		return (
			<AppLayout>
				<div className="flex-1 p-6">
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-gray-800">CCA Members</h1>
					</div>

					<Card className="bg-red-50 border-red-200">
						<CardContent className="flex flex-col items-center p-6 gap-4">
							<p className="text-red-700 font-medium text-center">⚠️ {error}</p>
							<Button
								variant="default"
								className="bg-blue-500 text-white hover:bg-blue-400 px-6 py-4 shadow-md font-bold cursor-pointer"
								onClick={() => router.push("/dashboard/mycca/admin")}
							>
								Back to My CCAs
							</Button>
						</CardContent>
					</Card>
				</div>
			</AppLayout>
		);
	}

	const renderMemberGroup = (
		title: string,
		members: Member[],
		showActionsColumn: boolean = false,
		showAddButton: boolean = false,
	) => {
		if (members.length === 0 && !showActionsColumn && !showAddButton) return null;

		const canManage = permissions.canManageMembers;
		const showEditableCommitment = canManage && !isSports;

		// Build columns based on whether we can manage
		const columnsToUse: SimpleTableColumn<Member>[] =
			showActionsColumn && canManage
				? [
						...memberTableColumns,
						{
							accessorKey: "commitment_period" as keyof Member,
							header: "Commitment",
							cell: (value, row: Member) =>
								showEditableCommitment ? (
									<select
										value={(typeof value === "string" ? value : null) || "full-year"}
										onChange={(e) => updateCommitment(row.user_id, e.target.value as CommitmentPeriod)}
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
							accessorKey: "actions" as keyof Member,
							header: "Actions",
							cell: (_value, row: Member) => (
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
													<DropdownMenuItem
														onClick={() => updateStatus(row.user_id, row.name, null)}
													>
														Move to Members
													</DropdownMenuItem>
												)}
												{SPORTS_STATUS_OPTIONS.filter(
													(option) => option.status !== row.cut_status,
												).map((option) => (
													<DropdownMenuItem
														key={option.status}
														onClick={() => updateStatus(row.user_id, row.name, option.status)}
													>
														{option.label}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => removeMember(row.user_id, row.name)}
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
													<DropdownMenuItem
														onClick={() => updateStatus(row.user_id, row.name, null)}
													>
														Move to Members
													</DropdownMenuItem>
												) : null}
												{CULTURE_STATUS_OPTIONS.filter(
													(option) => option.status !== row.cut_status,
												).map((option) => (
													<DropdownMenuItem
														key={option.status}
														onClick={() => updateStatus(row.user_id, row.name, option.status)}
													>
														{option.label}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => removeMember(row.user_id, row.name)}
													className="text-red-600"
												>
													Remove Member
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
									<Button
										size="sm"
										onClick={() => removeMember(row.user_id, row.name)}
										className="bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
									>
											Remove
										</Button>
									)}
								</div>
							),
						},
					]
				: [
						...memberTableColumns,
						{
							accessorKey: "commitment_period" as keyof Member,
							header: "Commitment",
							cell: (value) => (
								<span>{formatCommitmentPeriod(value as CommitmentPeriod | null | undefined)}</span>
							),
						},
					];

		return (
			<div className="mb-8">
				{/* Group Header */}
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
					<h3 className="text-xl font-semibold">{title}</h3>
					{canManage && showAddButton && isSportsCulture && (
						<Button
							onClick={() => setShowAddMemberModal(true)}
							size="sm"
							className="bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
						>
							+ Add Member
						</Button>
					)}
				</div>

				{/* Empty Section */}
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
	};

	const leadershipMembers = [
		...(groupedMembers.lead || []),
		...(groupedMembers.vice || []),
	];
	const isSports = permissions.ccaType === "sports";
	const isCulture = permissions.ccaType === "culture";
	const isSportsCulture = ["sports", "culture"].includes(permissions.ccaType);
	const totalFilteredMembers = Object.values(groupedMembers).flat().length;

	return (
		<AppLayout>
			<div className="flex flex-col space-y-4 p-4">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<h1 className="text-2xl font-semibold">CCA Members - {cca?.name}</h1>
					<div className="flex flex-wrap items-center gap-4">
						{pendingChanges.length > 0 && (
							<Button
								onClick={() => void saveAll()}
								disabled={saving}
								size="lg"
								className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer"
							>
								{saving ? "Saving..." : `Save Members (${pendingChanges.length})`}
							</Button>
						)}
						<Link href="/dashboard/mycca/admin">
							<Button variant="outline" size="lg" className="px-6 py-4">
								<ArrowLeft className="h-4 w-4" />
								Back to my CCAs
							</Button>
						</Link>
					</div>
				</div>

				{pendingChanges.length > 0 && (
					<Alert className="mb-4 bg-yellow-50 border-amber-600 py-3 rounded-sm">
						<AlertCircleIcon color="#a96800" />
						<AlertDescription className="text-yellow-700 ml-1">
							<span>
								<strong>{pendingChanges.length}</strong> pending changes. Click &quot;Save
								Members&quot; to apply.
							</span>
						</AlertDescription>
					</Alert>
				)}

				{isSportsCulture && (
					<Card className="mb-4 bg-sky-50 border-blue-400 py-3 rounded-sm">
						<CardContent className="text-sky-900 text-sm pl-4">
							{permissions.canManageMembers
								? "You may add and remove members for your sports/culture CCA."
								: "Member management is currently not available."}
						</CardContent>
					</Card>
				)}

				{!isSportsCulture && !permissions.canManageMembers && (
					<Card className="mb-4 bg-slate-50 border-slate-300 py-3 rounded-sm">
						<CardContent className="text-slate-700 text-sm pl-4">
							{permissions.managementMessage || "Member management is currently not available."}
						</CardContent>
					</Card>
				)}

				{totalFilteredMembers === 0 && !isSportsCulture ? (
					<div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 bg-gray-50 rounded-md">
						<p className="text-lg mb-2">📋 No members found for this CCA.</p>
						<p className="text-sm text-gray-400">
							Members will appear here when they are appointed to positions in this CCA.
						</p>
					</div>
				) : (
					<div className="space-y-8">
						{renderMemberGroup("Leadership", leadershipMembers)}
						{!isSportsCulture &&
							renderMemberGroup(
								"Main Committee",
								groupedMembers.maincomm || [],
								true,
								false,
							)}
						{!isSportsCulture &&
							renderMemberGroup("Sub Committee", groupedMembers.subcomm || [], true, false)}
						{isSportsCulture &&
							renderMemberGroup("Team Manager", groupedMembers.teamManager || [])}

						{isSports &&
							renderMemberGroup(
								"Final Cut - IHG Team Members (IVP)",
								groupedMembers.ivpIhgTeam || [],
								true,
								false,
							)}
						{isSports &&
							renderMemberGroup(
								"Final Cut - IHG Team Members",
								groupedMembers.ihgTeam || [],
								true,
								false,
							)}
						{isSports &&
							renderMemberGroup(
								"Final Cut Members",
								groupedMembers.finalCut || [],
								true,
								false,
							)}
						{isCulture &&
							renderMemberGroup("IVP Members", groupedMembers.firstCut || [], true, false)}

						{renderMemberGroup("Members", groupedMembers.members || [], true, true)}
					</div>
				)}
				<Alert className="bg-blue-500/10 dark:bg-blue-600/20 text-blue-500 border-none">
					<Volleyball className="size-4" />
					<AlertTitle>
						<strong>Total Members:</strong> {totalFilteredMembers}
					</AlertTitle>
				</Alert>

				{/* Add Member Modal */}
				{showAddMemberModal && isSportsCulture && (
					<div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
						<div className="bg-white p-6 rounded-xl w-[90%] max-w-[750px] max-h-[80vh] overflow-auto">
							<h3 className="text-lg font-bold mb-4">Add Member</h3>
							{selectedUser ? (
								<div className="space-y-4">
									<div className="p-4 bg-gray-50 rounded-md">
										<p className="font-bold">{selectedUser.name}</p>
										<p className="text-sm text-gray-500">{selectedUser.email}</p>
									</div>

									<div>
										<label className="block text-sm font-medium mb-1">Position</label>
										<select
											className="w-full border rounded p-2 bg-white"
											value={addForm.positionId}
											onChange={(e) =>
												setAddForm({ ...addForm, positionId: Number(e.target.value) })
											}
										>
											{allPositions
												.filter((pos) => !isChairPositionType(pos.position_type))
												.map((pos) => (
													<option key={pos.id} value={pos.id}>
														{pos.name}
													</option>
												))}
										</select>
									</div>

									<div>
										<label className="block text-sm font-medium mb-1">Commitment Period</label>
										<select
											className="w-full border rounded p-2 bg-white"
											value={addForm.commitmentPeriod}
											onChange={(e) =>
												setAddForm({
													...addForm,
													commitmentPeriod: e.target.value as CommitmentPeriod,
												})
											}
										>
											<option value="full-year">Full Year</option>
											<option value="semester-1">Semester 1</option>
											<option value="semester-2">Semester 2</option>
										</select>
									</div>

									<div className="flex justify-end gap-2 mt-6">
										<Button
											onClick={() => setSelectedUser(null)}
											variant="outline"
											className="bg-gray-100 hover:bg-gray-200"
										>
											Back
										</Button>
										<Button
											onClick={() =>
												addMember(
													selectedUser.id,
													selectedUser.name,
													selectedUser.email,
													selectedUser.room || undefined,
													addForm.positionId,
													(addForm.commitmentPeriod || "full-year") as CommitmentPeriod,
												)
											}
											className="bg-green-600 hover:bg-green-500 text-white"
										>
											Confirm Add
										</Button>
									</div>
								</div>
							) : (
								<>
									<div className="flex gap-4 mb-4">
										<Input
											type="text"
											placeholder="Search by name / email / room..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											onKeyDown={handleSearchKeyDown}
											className="focus-visible:ring-[2px] focus-visible:ring-blue-500/20 focus-visible:border-blue-500 py-5 rounded-sm border border-gray-300 w-full pl-4"
										/>
										<Button
											onClick={() => void searchUser()}
											disabled={searchLoading}
											className="bg-blue-500 text-white hover:bg-blue-400 px-8 py-3 shadow-md font-bold cursor-pointer"
										>
											{searchLoading ? "Searching..." : "Search"}
										</Button>
									</div>

									{searchLoading && (
										<div className="flex items-center justify-center mt-4">
											<LoadingSpinner message="Searching users..." fullHeight={false} />
										</div>
									)}

									<div className="mt-4">
										<div className="space-y-2 max-h-64 overflow-y-auto">
											{searchResults.map((user) => (
												<div
													key={user.id}
													className="flex justify-between items-center p-3 border border-gray-200 rounded-md bg-white shadow-sm"
												>
													<div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
														<strong className="font-bold">{user.name}</strong>
														<span className="text-gray-500">({user.email})</span>
														{user.room && <span className="text-gray-400">- {user.room}</span>}
													</div>

													<Button
														size="sm"
														onClick={() => handleUserButtonClick(user)}
														className={
															isUserAdded(user.id)
																? "bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
																: "bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
														}
													>
														{getUserButtonText(user.id)}
													</Button>
												</div>
											))}
										</div>
									</div>
								</>
							)}

							<div className="mt-6 flex justify-end">
								<Button
									onClick={() => {
										setShowAddMemberModal(false);
										setSearchQuery("");
										setSelectedUser(null);
										setAddForm({ positionId: 0, commitmentPeriod: "" });
									}}
									className="bg-gray-500 text-white hover:bg-gray-400 px-6 py-4 shadow-md font-bold cursor-pointer"
								>
									Close
								</Button>
							</div>
						</div>
					</div>
				)}
				{/* Error Modal */}
				<Dialog open={saveErrors.length > 0} onOpenChange={(open) => !open && setSaveErrors([])}>
					<DialogContent className="border-l-4 border-red-500 max-w-[500px]">
						<DialogHeader>
							<DialogTitle className="text-red-600 flex items-center gap-2">
								<AlertCircleIcon className="h-5 w-5" />
								Errors Occurred
							</DialogTitle>
							<DialogDescription>
								The following errors prevented some changes from being saved:
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2 my-4 max-h-60 overflow-y-auto">
							{saveErrors.map((err, idx) => (
								<div
									key={idx}
									className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100 break-words"
								>
									{err}
								</div>
							))}
						</div>
						<div className="flex justify-end">
							<Button
								onClick={() => setSaveErrors([])}
								className="bg-gray-800 text-white hover:bg-gray-700"
							>
								Close
							</Button>
						</div>
					</DialogContent>
				</Dialog>
				{saving && <LoadingSpinner message="Saving changes..." overlay />}
			</div>
		</AppLayout>
	);
}
