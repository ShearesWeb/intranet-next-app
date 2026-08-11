"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { MemberPermissions, PendingChange } from "@/types/members";

interface UseMemberSaveDeps {
	pendingChanges: PendingChange[];
	permissions: MemberPermissions;
	memberPositionId: number | null;
	refetch: () => Promise<void>;
	setPendingChanges: React.Dispatch<React.SetStateAction<PendingChange[]>>;
}

interface UseMemberSaveReturn {
	saving: boolean;
	saveErrors: string[];
	setSaveErrors: (errors: string[]) => void;
	saveAll: () => Promise<void>;
}

export function useMemberSave(ccaId: string | null, deps: UseMemberSaveDeps): UseMemberSaveReturn {
	const { pendingChanges, permissions, memberPositionId, refetch } = deps;

	const [saving, setSaving] = useState(false);
	const [saveErrors, setSaveErrorsState] = useState<string[]>([]);

	const setSaveErrors = useCallback((errors: string[]) => {
		setSaveErrorsState(errors);
	}, []);

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
									team_status: change.new_status,
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
								team_status: change.new_status,
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
		saving,
		saveErrors,
		setSaveErrors,
		saveAll,
	};
}
