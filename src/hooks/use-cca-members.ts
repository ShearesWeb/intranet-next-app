"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
	Period,
	CcaSummary,
	TeamStatus,
	GroupedMembers,
	Member,
	MemberPermissions,
	PendingChange,
	UserSearchResult,
} from "@/types/members";
import { getGroupFromStatus, getStatusLabel } from "@/lib/cca/team-status";
import { useMemberSearch } from "@/hooks/use-member-search";
import { useMemberSave } from "@/hooks/use-member-save";

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
		commitmentPeriod?: Period,
	) => void;
	removeMember: (userId: number, memberName: string) => void;
	updateStatus: (userId: number, memberName: string, newStatus: TeamStatus | null) => void;
	updateCommitment: (userId: number, newPeriod: Period) => void;
	saveAll: () => Promise<void>;
	refetch: () => Promise<void>;
}

const defaultPermissions: MemberPermissions = {
	canManageMembers: false,
	ccaKind: "",
	managementMessage: "",
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
	const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

	const isSports = permissions.ccaKind === "sports";
	const isCulture = permissions.ccaKind === "culture";

	const search = useMemberSearch(ccaId);
	const { clearSearch } = search;

	const resetState = useCallback(() => {
		setOriginalGroupedMembers({});
		setCurrentGroupedMembers({});
		setCCA(null);
		setPermissions(defaultPermissions);
		setMemberPositionId(null);
		setAllPositions([]);
		setError(null);
		setPendingChanges([]);
		clearSearch();
	}, [clearSearch]);

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

	const { saving, saveErrors, setSaveErrors, saveAll } = useMemberSave(ccaId, {
		pendingChanges,
		permissions,
		memberPositionId,
		refetch,
		setPendingChanges,
	});

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
			commitmentPeriod?: Period,
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
				position_type: (position?.position_type as Member["position_type"]) || "member",
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
			search.clearSearch();
		},
		[allPositions, currentMembers, pendingChanges, permissions, search],
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
		(userId: number, memberName: string, newStatus: TeamStatus | null) => {
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

			if (member.team_status === newStatus) {
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
					{ ...member, team_status: newStatus },
				];
				return updated;
			});

			toast.success(`Moved ${memberName} to ${getStatusLabel(newStatus)}`);
		},
		[currentMembers, isCulture, isSports, memberPositionId, permissions],
	);

	const updateCommitment = useCallback(
		(userId: number, newPeriod: Period) => {
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
		searchQuery: search.searchQuery,
		setSearchQuery: search.setSearchQuery,
		searchResults: search.searchResults,
		searchLoading: search.searchLoading,
		searchUser: search.searchUser,
		addMember,
		removeMember,
		updateStatus,
		updateCommitment,
		saveAll,
		refetch,
	};
}
