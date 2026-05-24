import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { CCAMember } from "@/types/ranking";
import type { RankingsApiResponse } from "@/types/ranking-api";
import {
	buildPositionGroups,
	chunkRankingPayloads,
	cloneMembers,
	getChangedRankingPayloads,
	getHasChanges,
	getUnrankedCount,
	mapRankingsApiMemberToEditorMember,
	MAX_SAVE_PAYLOAD_BYTES,
	recalculateRankings,
} from "@/lib/ranking/ranking-editor";

type FieldValue = CCAMember[keyof CCAMember];

export function useRankingEditor(ccaId: string | null) {
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [members, setMembers] = useState<CCAMember[]>([]);
	const [initialMembers, setInitialMembers] = useState<CCAMember[]>([]);
	const [ccaType, setCcaType] = useState("");
	const [error, setError] = useState<string | null>(null);

	const loadRankings = useCallback(async () => {
		if (!ccaId) {
			setMembers([]);
			setInitialMembers([]);
			setCcaType("");
			setError(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/cca/${ccaId}/rankings`);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to fetch rankings");
			}

			const data = (await response.json()) as RankingsApiResponse;
			const normalizedMembers = recalculateRankings(
				data.members.map(mapRankingsApiMemberToEditorMember),
				data.cca_type || "",
			);

			setMembers(normalizedMembers);
			setInitialMembers(cloneMembers(normalizedMembers));
			setCcaType(data.cca_type || "");
			setError(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to fetch rankings";
			console.error("Error loading rankings:", error);
			setMembers([]);
			setInitialMembers([]);
			setCcaType("");
			setError(message);
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	}, [ccaId]);

	useEffect(() => {
		void loadRankings();
	}, [loadRankings]);

	const positionGroups = useMemo(() => buildPositionGroups(members), [members]);
	const unrankedCount = useMemo(() => getUnrankedCount(members, ccaType), [members, ccaType]);
	const hasChanges = useMemo(
		() => getHasChanges(members, initialMembers),
		[members, initialMembers],
	);

	const handleFieldChange = useCallback(
		<K extends keyof CCAMember>(rowKey: string, field: K, value: FieldValue) => {
			setMembers((prev) => {
				const updated = prev.map((member) =>
					member.row_key === rowKey ? { ...member, [field]: value as CCAMember[K] } : member,
				);
				return recalculateRankings(updated, ccaType);
			});
		},
		[ccaType],
	);

	const handleSave = useCallback(async () => {
		if (!ccaId) return;

		setIsSaving(true);
		setError(null);
		const changedRankings = getChangedRankingPayloads(members, initialMembers);

		try {
			if (changedRankings.length === 0) {
				toast.success("No ranking changes to save.");
				return;
			}

			const rankingChunks = chunkRankingPayloads(changedRankings, MAX_SAVE_PAYLOAD_BYTES);

			for (const rankingChunk of rankingChunks) {
				const response = await fetch(`/api/cca/${ccaId}/rankings`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(rankingChunk),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.error || "Failed to save rankings");
				}
			}

			toast.success(
				rankingChunks.length > 1
					? `Saved ${changedRankings.length} rankings in ${rankingChunks.length} batches.`
					: "Rankings saved successfully!",
			);
			setInitialMembers(cloneMembers(members));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to save rankings";
			console.error("Error saving rankings:", error);
			setError(message);
			toast.error(message);
		} finally {
			setIsSaving(false);
		}
	}, [ccaId, initialMembers, members]);

	return {
		isLoading,
		isSaving,
		members,
		initialMembers,
		ccaType,
		error,
		positionGroups,
		unrankedCount,
		hasChanges,
		handleFieldChange,
		handleSave,
	};
}
