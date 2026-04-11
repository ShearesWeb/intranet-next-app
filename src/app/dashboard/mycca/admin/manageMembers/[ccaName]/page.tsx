// src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import {
	Member,
	PendingChange,
	UserSearchResult,
	CutStatus,
	CommitmentPeriod,
} from "@/types/dashboard";
import { CcaSummary, GroupedMembers, MemberPermissions } from "@/types/cca-members";

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

// Custom table component
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import Link from "next/link";

const isChairPositionType = (value: string | null | undefined) => {
	const normalized = (value || "").trim().replace(/\s+/g, " ").toLowerCase();
	return normalized === "lead" || normalized === "vice";
};

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

type PositionOption = {
	id: number;
	name: string;
	position_type: string;
};

const SPORTS_STATUS_OPTIONS: Array<{ status: CutStatus; label: string }> = [
	{ status: "ivp-ihg-team", label: "Move to IHG Team (IVP)" },
	{ status: "ihg-team", label: "Move to IHG Team" },
	{ status: "final-cut", label: "Move to Final Cut" },
];

const CULTURE_STATUS_OPTIONS: Array<{ status: CutStatus; label: string }> = [
	{ status: "first-cut", label: "Promote to IVP" },
];

const formatCommitmentPeriod = (value: CommitmentPeriod | null | undefined) => {
	switch (value) {
		case "semester-1":
			return "Semester 1";
		case "semester-2":
			return "Semester 2";
		case "full-year":
			return "Full Year";
		default:
			return "-";
	}
};

export default function ManageMembersPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const ccaId = searchParams.get("ccaId");

	// Original state
	const [originalGroupedMembers, setOriginalGroupedMembers] = useState<GroupedMembers>({});
	const [currentGroupedMembers, setCurrentGroupedMembers] = useState<GroupedMembers>({});

	// UI state
	const [cca, setCCA] = useState<CcaSummary | null>(null);
	const [permissions, setPermissions] = useState<MemberPermissions>({
		canManageMembers: false,
		ccaType: "",
		managementMessage: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [memberPositionId, setMemberPositionId] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	// Modal state
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [userSearchQuery, setUserSearchQuery] = useState("");
	const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
	const [addForm, setAddForm] = useState<{
		positionId: number;
		commitmentPeriod: CommitmentPeriod | "";
	}>({
		positionId: 0,
		commitmentPeriod: "",
	});
	const [allPositions, setAllPositions] = useState<PositionOption[]>([]);
	const [saveErrors, setSaveErrors] = useState<string[]>([]);

	// Pending changes
	const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

	const fetchMembers = useCallback(async () => {
		try {
			setLoading(true);
			if (!ccaId) {
				throw new Error("CCA ID is required");
			}
			const response = await fetch(`/api/cca/${ccaId}/members`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to fetch members");
			}

			const data = await response.json();
			setOriginalGroupedMembers(data.groupedMembers || {});
			setCurrentGroupedMembers(data.groupedMembers || {});
			setCCA(data.cca);
			setPermissions(
				data.permissions || { canManageMembers: false, ccaType: "", managementMessage: "" },
			);
			setMemberPositionId(data.member_position_id || 0);
			setAllPositions(data.all_positions || []);
			setError(null);
			setPendingChanges([]); // Reset pending changes
		} catch (error: unknown) {
			console.error("Error fetching members:", error);
			const message = error instanceof Error ? error.message : "Failed to fetch members";
			setError(message);
			if (message.includes("Unauthorized")) {
				toast.error("You are not authorized to manage this CCA");
				router.push("/dashboard/mycca/admin");
			} else {
				toast.error("Failed to load members");
			}
		} finally {
			setLoading(false);
		}
	}, [ccaId, router]);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	const handleSearchUsers = async () => {
		const query = userSearchQuery.trim();
		if (!ccaId) {
			toast.error("CCA ID is required to search users");
			setUserSearchResults([]);
			return;
		}

		if (query.length < 2) {
			toast.error("Please enter at least 2 characters to search");
			setUserSearchResults([]);
			return;
		}

		setIsSearching(true);
		try {
			const response = await fetch(
				`/api/cca/${ccaId}/searchUsers?query=${encodeURIComponent(query)}`,
			);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || data.error || "Failed to search users");
			}
			setUserSearchResults(data.data || []);
		} catch (error) {
			console.error("Error searching users:", error);
			const message = error instanceof Error ? error.message : "Failed to search users";
			toast.error(message);
			setUserSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearchKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearchUsers();
		}
	};

	// Local add member (doesn't call API yet)
	const handleLocalAddMember = (
		userId: number,
		userName: string,
		userEmail: string,
		userRoom?: string,
		positionId?: number,
		commitmentPeriod?: CommitmentPeriod,
	) => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		// Check if user is already a member or pending add
		const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
		const isAlreadyMember = allCurrentMembers.some((member) => member.user_id === userId);
		const isPendingAdd = pendingChanges.some(
			(change) => change.type === "add" && change.user_id === userId,
		);

		if (isAlreadyMember || isPendingAdd) {
			toast.error("User is already a member or pending addition");
			return;
		}

		// Add to pending changes
		const newChange: PendingChange = {
			type: "add",
			user_id: userId,
			user_name: userName,
			user_email: userEmail,
			user_room: userRoom || "",
			position_id: positionId,
			new_commitment_period: commitmentPeriod,
		};

		setPendingChanges((prev) => [...prev, newChange]);

		// Find position name
		const position = allPositions.find((p) => p.id === positionId);
		const positionName = position ? position.name : "Member";

		// Add to current members display (for immediate UI feedback)
		const newMember: Member = {
			user_id: userId,
			name: userName,
			email: userEmail,
			room: userRoom || "",
			position_name: positionName,
			position_type: position?.position_type || "member",
			points: 0,
			appointed_date: new Date().toISOString(),
			commitment_period: commitmentPeriod || null,
			position_id: positionId,
		};

		setCurrentGroupedMembers((prev) => ({
			...prev,
			members: [...(prev.members || []), newMember],
		}));

		toast.success(`${userName} added to pending changes`);

		// Clear search and selection
		setUserSearchQuery("");
		setUserSearchResults([]);
		setSelectedUser(null);
		setAddForm({ positionId: 0, commitmentPeriod: "" });
		setShowAddMemberModal(false);
	};

	// Local remove member
	const handleLocalRemoveMember = (userId: number, memberName: string) => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		// Check if this is an original member (needs API removal)
		const allOriginalMembers = Object.values(originalGroupedMembers).flat() as Member[];
		const member = allOriginalMembers.find((m) => m.user_id === userId);

		setPendingChanges((prev) => {
			const remainingChanges = prev.filter((change) => change.user_id !== userId);

			if (!member) {
				return remainingChanges;
			}

			const newChange: PendingChange = {
				type: "remove",
				user_id: userId,
				user_name: memberName,
				user_email: "",
				position_id: member.position_id,
			};

			return [...remainingChanges, newChange];
		});

		// Remove from current display
		setCurrentGroupedMembers((prev) => {
			const updated: GroupedMembers = { ...prev };
			Object.keys(updated).forEach((key) => {
				updated[key] = updated[key].filter((member: Member) => member.user_id !== userId);
			});
			return updated;
		});

		toast.success(`${memberName} marked for removal`);
	};

	const getGroupFromStatus = (status: CutStatus | undefined | null) => {
		switch (status) {
			case "ivp-ihg-team":
				return "ivpIhgTeam";
			case "ihg-team":
				return "ihgTeam";
			case "final-cut":
				return "finalCut";
			case "first-cut":
				return "firstCut";
			default:
				return "members";
		}
	};

	const getStatusLabel = (status: CutStatus | undefined | null) => {
		switch (status) {
			case "ivp-ihg-team":
				return "Final Cut - IHG Team Members (IVP)";
			case "ihg-team":
				return "Final Cut - IHG Team Members";
			case "final-cut":
				return "Final Cut Members";
			case "first-cut":
				return "IVP Members";
			default:
				return "Members";
		}
	};

	// Local update status
	const handleLocalUpdateStatus = (
		userId: number,
		memberName: string,
		newStatus: CutStatus | null,
	) => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		if (!isSports && !isCulture) {
			toast.error("Status groups are only available for sports and culture CCAs");
			return;
		}

		const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
		const member = allCurrentMembers.find((m) => m.user_id === userId);

		if (!member) {
			toast.error(`${memberName} not found in current members`);
			return;
		}

		if (member.cut_status === newStatus) {
			toast.error(`${memberName} is already in this status`);
			return;
		}

		const resolvedPositionId = member.position_id || memberPositionId || undefined;

		setPendingChanges((prev) => {
			const withoutExistingStatusChanges = prev.filter(
				(change) => !(change.type === "update_status" && change.user_id === userId),
			);

			const pendingAdd = withoutExistingStatusChanges.find(
				(change) => change.type === "add" && change.user_id === userId,
			);

			if (pendingAdd) {
				return withoutExistingStatusChanges.map((change) => {
					if (change.type === "add" && change.user_id === userId) {
						return {
							...change,
							new_status: newStatus,
							position_id: change.position_id || resolvedPositionId,
						};
					}

					return change;
				});
			}

			const newChange: PendingChange = {
				type: "update_status",
				user_id: userId,
				user_name: memberName,
				user_email: member.email,
				user_room: member.room,
				new_status: newStatus,
				position_id: resolvedPositionId,
			};

			return [...withoutExistingStatusChanges, newChange];
		});

		// Update currentGroupedMembers locally
		setCurrentGroupedMembers((prev) => {
			const updated: GroupedMembers = { ...prev };

			// Helper to remove member from any group
			const removeFromGroup = (group: Member[] | undefined) =>
				(group || []).filter((m) => m.user_id !== userId);

			Object.keys(updated).forEach((key) => {
				updated[key] = removeFromGroup(updated[key]);
			});

			// Add to new group
			const targetGroup = getGroupFromStatus(newStatus);
			if (targetGroup) {
				updated[targetGroup] = [
					...(updated[targetGroup] || []),
					{ ...member, cut_status: newStatus },
				];
			}

			return updated;
		});

		toast.success(`Moved ${memberName} to ${getStatusLabel(newStatus)}`);
	};

	const handleLocalUpdateCommitment = (userId: number, newPeriod: CommitmentPeriod) => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
		const member = allCurrentMembers.find((m) => m.user_id === userId);

		if (!member) {
			toast.error("Member not found");
			return;
		}

		if (member.commitment_period === newPeriod) return;

		const resolvedPositionId = member.position_id || memberPositionId || undefined;

		setPendingChanges((prev) => {
			const withoutExistingCommitmentChanges = prev.filter(
				(change) => !(change.type === "update_commitment" && change.user_id === userId),
			);

			const pendingAdd = withoutExistingCommitmentChanges.find(
				(change) => change.type === "add" && change.user_id === userId,
			);

			if (pendingAdd) {
				return withoutExistingCommitmentChanges.map((change) => {
					if (change.type === "add" && change.user_id === userId) {
						return {
							...change,
							new_commitment_period: newPeriod,
							position_id: change.position_id || resolvedPositionId,
						};
					}

					return change;
				});
			}

			const newChange: PendingChange = {
				type: "update_commitment",
				user_id: userId,
				user_name: member.name,
				user_email: member.email,
				new_commitment_period: newPeriod,
				position_id: resolvedPositionId,
			};

			return [...withoutExistingCommitmentChanges, newChange];
		});

		// Update local state
		setCurrentGroupedMembers((prev) => {
			const updated: GroupedMembers = { ...prev };
			Object.keys(updated).forEach((key) => {
				updated[key] = updated[key].map((m) =>
					m.user_id === userId ? { ...m, commitment_period: newPeriod } : m,
				);
			});
			return updated;
		});

		toast.success("Commitment period updated (pending save)");
	};

	// Save all pending changes
	const handleSaveMembers = async () => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		if (pendingChanges.length === 0) {
			toast.error("No changes to save");
			return;
		}

		setSaving(true);
		setSaveErrors([]);
		let successCount = 0;
		let errorCount = 0;
		const currentErrors: string[] = [];

		try {
			for (const change of pendingChanges) {
				try {
					if (change.type === "add") {
						const response = await fetch(`/api/cca/${ccaId}/addMember`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: change.user_id,
								reason: "Added by lead/vice",
								position_id: change.position_id,
								commitment_period: change.new_commitment_period,
							}),
						});

						const responseData = await response.json().catch(() => ({}));
						if (!response.ok) {
							throw new Error(responseData.error || "Failed to add member");
						}

						if (change.new_status !== undefined) {
							const resolvedPositionId =
								responseData.position_id || change.position_id || memberPositionId;
							const statusResponse = await fetch(`/api/cca/${ccaId}/updateMember`, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									user_id: change.user_id,
									position_id: resolvedPositionId,
									cut_status: change.new_status,
								}),
							});

							const statusResponseData = await statusResponse.json().catch(() => ({}));
							if (!statusResponse.ok) {
								throw new Error(
									statusResponseData.error || "Member added but failed to update status",
								);
							}
						}
						successCount++;
					} else if (change.type === "remove") {
						const response = await fetch(`/api/cca/${ccaId}/removeMember`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: change.user_id,
								reason: "Removed by lead/vice",
								position_id: change.position_id,
							}),
						});

						if (!response.ok) {
							const errorData = await response.json();
							throw new Error(errorData.error || "Failed to remove member");
						}
						successCount++;
					} else if (change.type === "update_status") {
						if (!change.position_id && !memberPositionId) {
							throw new Error("Missing position ID for status update");
						}
						const response = await fetch(`/api/cca/${ccaId}/updateMember`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: change.user_id,
								position_id: change.position_id || memberPositionId,
								cut_status: change.new_status,
							}),
						});

						if (!response.ok) {
							const errorData = await response.json();
							throw new Error(errorData.error || "Failed to update member status");
						}
						successCount++;
					} else if (change.type === "update_commitment") {
						const response = await fetch(`/api/cca/${ccaId}/updateMember`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: change.user_id,
								position_id: change.position_id || memberPositionId,
								commitment_period: change.new_commitment_period,
							}),
						});

						if (!response.ok) {
							const errorData = await response.json();
							throw new Error(errorData.error || "Failed to update commitment period");
						}
						successCount++;
					}
				} catch (error: unknown) {
					console.error(`Error processing ${change.type} for ${change.user_name}:`, error);
					errorCount++;
					const errorMsg = error instanceof Error ? error.message : "Unknown error";
					currentErrors.push(`${change.user_name}: ${errorMsg}`);
				}
			}

			if (successCount > 0) {
				toast.success(`Successfully processed ${successCount} changes`);
			}
			if (errorCount > 0) {
				setSaveErrors(currentErrors);
			}

			// Refresh data from server
			await fetchMembers();
		} catch (error) {
			console.error("Error saving members:", error);
			toast.error("Failed to save changes");
		} finally {
			setSaving(false);
		}
	};

	// Check if user is already added (locally or originally)
	const isUserAdded = (userId: number) => {
		const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
		return allCurrentMembers.some((member) => member.user_id === userId);
	};

	// Get button text for user in search results
	const getUserButtonText = (userId: number) => {
		return isUserAdded(userId) ? "Remove" : "Add";
	};

	// Handle adding/removing user from search results
	const handleUserButtonClick = (user: UserSearchResult) => {
		if (isUserAdded(user.id)) {
			handleLocalRemoveMember(user.id, user.name);
			return;
		}
		if (!isSportsCulture) {
			toast.error("Adding members is only available for sports and culture CCAs");
			return;
		}
		handleLocalAddMember(user.id, user.name, user.email, user.room || "");
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
										onChange={(e) =>
											handleLocalUpdateCommitment(row.user_id, e.target.value as CommitmentPeriod)
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
														onClick={() => handleLocalUpdateStatus(row.user_id, row.name, null)}
													>
														Move to Members
													</DropdownMenuItem>
												)}
												{SPORTS_STATUS_OPTIONS.filter(
													(option) => option.status !== row.cut_status,
												).map((option) => (
													<DropdownMenuItem
														key={option.status}
														onClick={() =>
															handleLocalUpdateStatus(row.user_id, row.name, option.status)
														}
													>
														{option.label}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleLocalRemoveMember(row.user_id, row.name)}
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
														onClick={() => handleLocalUpdateStatus(row.user_id, row.name, null)}
													>
														Move to Members
													</DropdownMenuItem>
												) : null}
												{CULTURE_STATUS_OPTIONS.filter(
													(option) => option.status !== row.cut_status,
												).map((option) => (
													<DropdownMenuItem
														key={option.status}
														onClick={() =>
															handleLocalUpdateStatus(row.user_id, row.name, option.status)
														}
													>
														{option.label}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleLocalRemoveMember(row.user_id, row.name)}
													className="text-red-600"
												>
													Remove Member
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										<Button
											size="sm"
											onClick={() => handleLocalRemoveMember(row.user_id, row.name)}
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
		...(currentGroupedMembers.lead || []),
		...(currentGroupedMembers.vice || []),
	];
	const isSports = permissions.ccaType === "sports";
	const isCulture = permissions.ccaType === "culture";
	const isSportsCulture = ["sports", "culture"].includes(permissions.ccaType);
	const totalFilteredMembers = Object.values(currentGroupedMembers).flat().length;

	return (
		<AppLayout>
			<div className="flex flex-col space-y-4 p-4">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<h1 className="text-2xl font-semibold">CCA Members - {cca?.name}</h1>
					<div className="flex flex-wrap items-center gap-4">
						{pendingChanges.length > 0 && (
							<Button
								onClick={handleSaveMembers}
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
								currentGroupedMembers.maincomm || [],
								true,
								false,
							)}
						{!isSportsCulture &&
							renderMemberGroup("Sub Committee", currentGroupedMembers.subcomm || [], true, false)}
						{isSportsCulture &&
							renderMemberGroup("Team Manager", currentGroupedMembers.teamManager || [])}

						{isSports &&
							renderMemberGroup(
								"Final Cut - IHG Team Members (IVP)",
								currentGroupedMembers.ivpIhgTeam || [],
								true,
								false,
							)}
						{isSports &&
							renderMemberGroup(
								"Final Cut - IHG Team Members",
								currentGroupedMembers.ihgTeam || [],
								true,
								false,
							)}
						{isSports &&
							renderMemberGroup(
								"Final Cut Members",
								currentGroupedMembers.finalCut || [],
								true,
								false,
							)}
						{isCulture &&
							renderMemberGroup("IVP Members", currentGroupedMembers.firstCut || [], true, false)}

						{renderMemberGroup("Members", currentGroupedMembers.members || [], true, true)}
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
												handleLocalAddMember(
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
											value={userSearchQuery}
											onChange={(e) => setUserSearchQuery(e.target.value)}
											onKeyPress={handleSearchKeyPress}
											className="focus-visible:ring-[2px] focus-visible:ring-blue-500/20 focus-visible:border-blue-500 py-5 rounded-sm border border-gray-300 w-full pl-4"
										/>
										<Button
											onClick={handleSearchUsers}
											disabled={isSearching}
											className="bg-blue-500 text-white hover:bg-blue-400 px-8 py-3 shadow-md font-bold cursor-pointer"
										>
											{isSearching ? "Searching..." : "Search"}
										</Button>
									</div>

									{isSearching && (
										<div className="flex items-center justify-center mt-4">
											<LoadingSpinner message="Searching users..." fullHeight={false} />
										</div>
									)}

									<div className="mt-4">
										<div className="space-y-2 max-h-64 overflow-y-auto">
											{userSearchResults.map((user) => (
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
										setUserSearchQuery("");
										setUserSearchResults([]);
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
