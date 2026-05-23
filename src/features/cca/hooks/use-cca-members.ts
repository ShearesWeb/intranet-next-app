import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
	CommitmentPeriod,
	CcaSummary,
	CutStatus,
	GroupedMembers,
	Member,
	MemberPermissions,
	PendingChange,
	UserSearchResult,
} from "@/features/cca/types/members";

type PositionOption = {
	id: number;
	name: string;
	position_type: string;
};

interface UseCcaMembersReturn {
	groupedMembers: GroupedMembers;
	cca: CcaSummary | null;
	permissions: MemberPermissions;
	memberPositionId: number | null;
	allPositions: PositionOption[];
	loading: boolean;
	error: string | null;
	saving: boolean;
	saveErrors: string[];
	setSaveErrors: (errors: string[]) => void;
	pendingChanges: PendingChange[];
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	searchResults: UserSearchResult[];
	searchLoading: boolean;
	searchUser: () => Promise<void>;
	addMember: (
		userId: number,
		userName: string,
		userEmail: string,
		userRoom?: string,
		positionId?: number,
		commitmentPeriod?: CommitmentPeriod,
	) => void;
	removeMember: (userId: number, memberName: string) => void;
	updateStatus: (userId: number, memberName: string, newStatus: CutStatus | null) => void;
	updateCommitment: (userId: number, newPeriod: CommitmentPeriod) => void;
	saveAll: () => Promise<void>;
	refetch: () => Promise<void>;
}

const defaultPermissions: MemberPermissions = {
	canManageMembers: false,
	ccaType: "",
	managementMessage: "",
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

export function useCcaMembers(ccaId: string | null): UseCcaMembersReturn {
	const router = useRouter();
	const [originalGroupedMembers, setOriginalGroupedMembers] = useState<GroupedMembers>({});
	const [currentGroupedMembers, setCurrentGroupedMembers] = useState<GroupedMembers>({});
	const [cca, setCCA] = useState<CcaSummary | null>(null);
	const [permissions, setPermissions] = useState<MemberPermissions>(defaultPermissions);
	const [memberPositionId, setMemberPositionId] = useState<number | null>(null);
	const [allPositions, setAllPositions] = useState<PositionOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveErrors, setSaveErrorsState] = useState<string[]>([]);
	const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
	const [searchQuery, setSearchQueryState] = useState("");
	const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);

	const isSports = permissions.ccaType === "sports";
	const isCulture = permissions.ccaType === "culture";

	const resetState = useCallback(() => {
		setOriginalGroupedMembers({});
		setCurrentGroupedMembers({});
		setCCA(null);
		setPermissions(defaultPermissions);
		setMemberPositionId(null);
		setAllPositions([]);
		setError(null);
		setSaving(false);
		setSaveErrorsState([]);
		setPendingChanges([]);
		setSearchQueryState("");
		setSearchResults([]);
		setSearchLoading(false);
	}, []);

	const refetch = useCallback(async () => {
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

			const json = await response.json();
			const data = json.data;
			setOriginalGroupedMembers(data.groupedMembers || {});
			setCurrentGroupedMembers(data.groupedMembers || {});
			setCCA(data.cca);
			setPermissions(data.permissions || defaultPermissions);
			setMemberPositionId(data.member_position_id ?? null);
			setAllPositions(data.all_positions || []);
			setError(null);
			setPendingChanges([]);
		} catch (error: unknown) {
			console.error("Error fetching members:", error);
			const message = error instanceof Error ? error.message : "Failed to fetch members";
			setError(message);
			if (message.includes("Unauthorized")) {
				toast.error("You are not authorized to manage this CCA");
				router.push("/dashboard/my-cca/admin");
			} else {
				toast.error("Failed to load members");
			}
		} finally {
			setLoading(false);
		}
	}, [ccaId, router]);

	useEffect(() => {
		resetState();
		void refetch();
	}, [refetch, resetState]);

	const setSearchQuery = useCallback((query: string) => {
		setSearchQueryState(query);
		if (query.trim().length < 2) {
			setSearchResults([]);
		}
	}, []);

	const setSaveErrors = useCallback((errors: string[]) => {
		setSaveErrorsState(errors);
	}, []);

	const searchUser = useCallback(async () => {
		const query = searchQuery.trim();
		if (!ccaId) {
			toast.error("CCA ID is required to search users");
			setSearchResults([]);
			return;
		}

		if (query.length < 2) {
			toast.error("Please enter at least 2 characters to search");
			setSearchResults([]);
			return;
		}

		setSearchLoading(true);
		try {
			const response = await fetch(
				`/api/cca/${ccaId}/search-users?query=${encodeURIComponent(query)}`,
			);
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to search users");
			}

			setSearchResults(json.data || []);
		} catch (error) {
			console.error("Error searching users:", error);
			const message = error instanceof Error ? error.message : "Failed to search users";
			toast.error(message);
			setSearchResults([]);
		} finally {
			setSearchLoading(false);
		}
	}, [ccaId, searchQuery]);

	const currentMembers = useMemo(
		() => Object.values(currentGroupedMembers).flat() as Member[],
		[currentGroupedMembers],
	);

	const originalMembers = useMemo(
		() => Object.values(originalGroupedMembers).flat() as Member[],
		[originalGroupedMembers],
	);

	const addMember = useCallback(
		(
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

			const isAlreadyMember = currentMembers.some((member) => member.user_id === userId);
			const isPendingAdd = pendingChanges.some(
				(change) => change.type === "add" && change.user_id === userId,
			);

			if (isAlreadyMember || isPendingAdd) {
				toast.error("User is already a member or pending addition");
				return;
			}

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

			const position = allPositions.find((item) => item.id === positionId);
			const positionName = position ? position.name : "Member";

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
			setSearchQueryState("");
			setSearchResults([]);
		},
		[allPositions, currentMembers, pendingChanges, permissions],
	);

	const removeMember = useCallback(
		(userId: number, memberName: string) => {
			if (!permissions.canManageMembers) {
				toast.error(permissions.managementMessage || "Member management is not available.");
				return;
			}

			const member = originalMembers.find((item) => item.user_id === userId);

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

			setCurrentGroupedMembers((prev) => {
				const updated: GroupedMembers = { ...prev };
				Object.keys(updated).forEach((key) => {
					updated[key] = updated[key].filter((currentMember) => currentMember.user_id !== userId);
				});
				return updated;
			});

			toast.success(`${memberName} marked for removal`);
		},
		[originalMembers, permissions],
	);

	const updateStatus = useCallback(
		(userId: number, memberName: string, newStatus: CutStatus | null) => {
			if (!permissions.canManageMembers) {
				toast.error(permissions.managementMessage || "Member management is not available.");
				return;
			}

			if (!isSports && !isCulture) {
				toast.error("Status groups are only available for sports and culture CCAs");
				return;
			}

			const member = currentMembers.find((item) => item.user_id === userId);
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

			setCurrentGroupedMembers((prev) => {
				const updated: GroupedMembers = { ...prev };
				Object.keys(updated).forEach((key) => {
					updated[key] = (updated[key] || []).filter(
						(currentMember) => currentMember.user_id !== userId,
					);
				});

				const targetGroup = getGroupFromStatus(newStatus);
				updated[targetGroup] = [
					...(updated[targetGroup] || []),
					{ ...member, cut_status: newStatus },
				];
				return updated;
			});

			toast.success(`Moved ${memberName} to ${getStatusLabel(newStatus)}`);
		},
		[currentMembers, isCulture, isSports, memberPositionId, permissions],
	);

	const updateCommitment = useCallback(
		(userId: number, newPeriod: CommitmentPeriod) => {
			if (!permissions.canManageMembers) {
				toast.error(permissions.managementMessage || "Member management is not available.");
				return;
			}

			const member = currentMembers.find((item) => item.user_id === userId);
			if (!member) {
				toast.error("Member not found");
				return;
			}

			if (member.commitment_period === newPeriod) {
				return;
			}

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

			setCurrentGroupedMembers((prev) => {
				const updated: GroupedMembers = { ...prev };
				Object.keys(updated).forEach((key) => {
					updated[key] = updated[key].map((currentMember) =>
						currentMember.user_id === userId
							? { ...currentMember, commitment_period: newPeriod }
							: currentMember,
					);
				});
				return updated;
			});

			toast.success("Commitment period updated (pending save)");
		},
		[currentMembers, memberPositionId, permissions],
	);

	const saveAll = useCallback(async () => {
		if (!permissions.canManageMembers) {
			toast.error(permissions.managementMessage || "Member management is not available.");
			return;
		}

		if (pendingChanges.length === 0) {
			toast.error("No changes to save");
			return;
		}

		setSaving(true);
		setSaveErrorsState([]);
		let successCount = 0;
		let errorCount = 0;
		const currentErrors: string[] = [];

		try {
			for (const change of pendingChanges) {
				try {
					if (change.type === "add") {
						const response = await fetch(`/api/cca/${ccaId}/members`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: change.user_id,
								reason: "Added by lead/vice",
								position_id: change.position_id,
								commitment_period: change.new_commitment_period,
							}),
						});

						const responseJson = await response.json().catch(() => ({}));
						if (!response.ok) {
							throw new Error(responseJson.error || "Failed to add member");
						}

						if (change.new_status !== undefined) {
							const resolvedPositionId =
								responseJson.data?.position_id || change.position_id || memberPositionId;

							const statusResponse = await fetch(`/api/cca/${ccaId}/members`, {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									user_id: change.user_id,
									position_id: resolvedPositionId,
									cut_status: change.new_status,
								}),
							});

							const statusResponseJson = await statusResponse.json().catch(() => ({}));
							if (!statusResponse.ok) {
								throw new Error(
									statusResponseJson.error || "Member added but failed to update status",
								);
							}
						}

						successCount++;
					} else if (change.type === "remove") {
						const response = await fetch(`/api/cca/${ccaId}/members`, {
							method: "DELETE",
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

						const response = await fetch(`/api/cca/${ccaId}/members`, {
							method: "PATCH",
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
						const response = await fetch(`/api/cca/${ccaId}/members`, {
							method: "PATCH",
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
					const errorMessage = error instanceof Error ? error.message : "Unknown error";
					currentErrors.push(`${change.user_name}: ${errorMessage}`);
				}
			}

			if (successCount > 0) {
				toast.success(`Successfully processed ${successCount} changes`);
			}

			if (errorCount > 0) {
				setSaveErrorsState(currentErrors);
			}

			await refetch();
		} catch (error) {
			console.error("Error saving members:", error);
			toast.error("Failed to save changes");
		} finally {
			setSaving(false);
		}
	}, [ccaId, memberPositionId, pendingChanges, permissions, refetch]);

	return {
		groupedMembers: currentGroupedMembers,
		cca,
		permissions,
		memberPositionId,
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
		refetch,
	};
}
