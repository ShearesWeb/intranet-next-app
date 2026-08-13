"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { diffApplicantsForSave } from "@/lib/allocation/applicant-diff";
import type { Applicant, CcaPositionGroup, Position } from "@/types/applicants";
import type { UserSearchResult } from "@/types/members";

export function useApplicantRankings(userEmail: string | undefined, opts?: { ccaId?: number }) {
	const [positions, setPositions] = useState<Position[]>([]);
	const [ccaOrder, setCcaOrder] = useState<Array<{ cca_id: number; cca_name: string }>>([]);
	const [loading, setLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [originalOrders, setOriginalOrders] = useState<Record<number, number[]>>({});
	const [hasChanges, setHasChanges] = useState<Record<number, boolean>>({});
	const [mounted, setMounted] = useState(false);
	const fetchingRef = useRef(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const fetchPositions = useRef(async (bustCache = false) => {
		if (!userEmail) return;
		try {
			const headers: HeadersInit = {};
			if (bustCache) {
				headers["Cache-Control"] = "no-cache";
				headers["Pragma"] = "no-cache";
			}
			const response = await fetch("/api/chair/positions/for-chair", { headers });
			const json = await response.json();
			const data = json.data ?? json;
			setPositions(data.positions || []);
			setCcaOrder(
				(data.ccas || []).map((c: CcaPositionGroup) => ({
					cca_id: c.cca_id,
					cca_name: c.cca_name,
				})),
			);
			const orderMap: Record<number, number[]> = {};
			const changesMap: Record<number, boolean> = {};
			(data.positions || []).forEach((pos: Position) => {
				orderMap[pos.id] = pos.applicants.map((app) => app.id);
				changesMap[pos.id] = false;
			});
			setOriginalOrders(orderMap);
			setHasChanges(changesMap);
		} catch (error) {
			console.error("Error fetching positions:", error);
			toast.error("Error loading positions");
		}
	});

	useEffect(() => {
		if (!userEmail || fetchingRef.current) return;
		fetchingRef.current = true;
		setLoading(true);
		fetchPositions.current().finally(() => {
			setLoading(false);
			fetchingRef.current = false;
		});
	}, [userEmail]);

	const checkForChanges = useCallback(
		(positionId: number, currentApplicants: Applicant[]) => {
			const originalOrder = originalOrders[positionId] || [];
			const currentOrder = currentApplicants.map((app) => app.id);
			const hasChanged = JSON.stringify(originalOrder) !== JSON.stringify(currentOrder);
			setHasChanges((prev) => ({ ...prev, [positionId]: hasChanged }));
		},
		[originalOrders],
	);

	const handleAddApplicant = useCallback(
		(positionId: number, userData: UserSearchResult) => {
			setPositions((prevPositions) =>
				prevPositions.map((pos) => {
					if (pos.id !== positionId) return pos;
					if (pos.applicants.some((app) => app.id === userData.id)) {
						toast.error("Applicant already added to this position");
						return pos;
					}
					const newApplicant: Applicant = {
						id: userData.id,
						name: userData.name,
						email: userData.email,
						room: userData.room || "N/A",
						ranking: null,
						applied: false,
					};
					const updatedApplicants = [...pos.applicants, newApplicant];
					setTimeout(() => checkForChanges(positionId, updatedApplicants), 0);
					return { ...pos, applicants: updatedApplicants };
				}),
			);
		},
		[checkForChanges],
	);

	const handleRemoveApplicant = useCallback(
		(positionId: number, userId: number) => {
			setPositions((prevPositions) =>
				prevPositions.map((pos) => {
					if (pos.id !== positionId) return pos;
					const updatedApplicants = pos.applicants.filter((app) => app.id !== userId);
					setTimeout(() => checkForChanges(positionId, updatedApplicants), 0);
					return { ...pos, applicants: updatedApplicants };
				}),
			);
		},
		[checkForChanges],
	);

	const handleReorderApplicants = useCallback(
		(positionId: number, newApplicants: Applicant[]) => {
			setPositions((prevPositions) =>
				prevPositions.map((pos) =>
					pos.id === positionId ? { ...pos, applicants: newApplicants } : pos,
				),
			);
			checkForChanges(positionId, newApplicants);
		},
		[checkForChanges],
	);

	const saveRankingsForPosition = useCallback(
		async (position: Position): Promise<boolean> => {
			try {
				const { toAdd, toRemove, rankings } = diffApplicantsForSave(position, originalOrders);

				for (const userId of toAdd) {
					const response = await fetch(`/api/chair/positions/${position.id}/applicants`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ user_id: userId }),
					});
					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(`Failed to add applicant: ${errorData.error}`);
					}
					await response.json();
				}

				for (const userId of toRemove) {
					const response = await fetch(`/api/chair/positions/${position.id}/applicants`, {
						method: "DELETE",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ user_id: userId }),
					});
					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(`Failed to remove applicant: ${errorData.error}`);
					}
					await response.json();
				}

				if (position.applicants.length > 0) {
					const response = await fetch(`/api/chair/positions/${position.id}/rank`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ rankings }),
					});
					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(`Failed to save rankings: ${errorData.error}`);
					}
					await response.json();
				}

				return true;
			} catch (error) {
				console.error("Error saving rankings:", error);
				toast.error(error instanceof Error ? error.message : "Failed to save preferences");
				return false;
			}
		},
		[originalOrders],
	);

	// When an `opts.ccaId` is given, scope the view (and saving) to that one CCA.
	// Positions for other CCAs stay loaded but, since they aren't rendered/edited,
	// they never become dirty — so save is naturally limited to this CCA.
	const ccaId = opts?.ccaId;
	const scopedPositions = useMemo(
		() => (ccaId == null ? positions : positions.filter((p) => p.cca_id === ccaId)),
		[positions, ccaId],
	);

	const handleSaveAll = useCallback(async () => {
		const dirty = scopedPositions.filter((p) => hasChanges[p.id]);
		if (dirty.length === 0) return;
		setIsSaving(true);
		const failures: string[] = [];
		try {
			for (const position of dirty) {
				const success = await saveRankingsForPosition(position);
				if (!success) failures.push(position.name);
			}
			await fetchPositions.current(true);
			if (failures.length === 0) {
				toast.success(
					dirty.length === 1
						? "Preferences saved!"
						: `Preferences saved for ${dirty.length} positions`,
				);
			} else {
				toast.error(`Failed to save: ${failures.join(", ")}`);
			}
		} finally {
			setIsSaving(false);
		}
	}, [scopedPositions, hasChanges, saveRankingsForPosition]);

	const hasAnyChanges = scopedPositions.some((p) => hasChanges[p.id]);

	const ccaGroups = useMemo<CcaPositionGroup[]>(() => {
		const map = new Map<number, CcaPositionGroup>();
		for (const { cca_id, cca_name } of ccaOrder) {
			map.set(cca_id, { cca_id, cca_name, positions: [] });
		}
		for (const pos of positions) {
			let group = map.get(pos.cca_id);
			if (!group) {
				group = { cca_id: pos.cca_id, cca_name: pos.cca_name, positions: [] };
				map.set(pos.cca_id, group);
			}
			group.positions.push(pos);
		}
		return Array.from(map.values()).filter((g) => g.positions.length > 0);
	}, [positions, ccaOrder]);

	const scopedCcaGroups = useMemo(
		() => (ccaId == null ? ccaGroups : ccaGroups.filter((g) => g.cca_id === ccaId)),
		[ccaGroups, ccaId],
	);

	return {
		positions: scopedPositions,
		ccaGroups: scopedCcaGroups,
		loading,
		isSaving,
		hasChanges,
		hasAnyChanges,
		mounted,
		handleAddApplicant,
		handleRemoveApplicant,
		handleReorderApplicants,
		handleSaveAll,
	};
}
