"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { diffApplicantsForSave } from "@/features/allocation/utils/applicant-diff";
import type { Applicant, Position } from "@/features/allocation/types/applicants";
import type { UserSearchResult } from "@/features/cca/types/members";

export function useApplicantRankings(userEmail: string | undefined) {
	const [positions, setPositions] = useState<Position[]>([]);
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
			const response = await fetch("/api/chair/positions/forChair", { headers });
			const data = await response.json();
			setPositions(data.positions || []);
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

	const handleMoveApplicant = useCallback(
		(positionIndex: number, applicantIndex: number, delta: number) => {
			setPositions((prevPositions) => {
				const newPositions = [...prevPositions];
				const position = newPositions[positionIndex];
				if (!position) return prevPositions;
				const apps = [...position.applicants];
				const targetIndex = applicantIndex + delta;
				if (targetIndex < 0 || targetIndex >= apps.length) return prevPositions;
				[apps[applicantIndex], apps[targetIndex]] = [apps[targetIndex], apps[applicantIndex]];
				newPositions[positionIndex] = { ...position, applicants: apps };
				checkForChanges(position.id, apps);
				return newPositions;
			});
		},
		[checkForChanges],
	);

	const saveRankingsForPosition = useCallback(
		async (position: Position): Promise<boolean> => {
			try {
				const { toAdd, toRemove, rankings } = diffApplicantsForSave(position, originalOrders);

				for (const userId of toAdd) {
					const response = await fetch(`/api/chair/positions/${position.id}/addApplicant`, {
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
					const response = await fetch(`/api/chair/positions/${position.id}/removeApplicant`, {
						method: "POST",
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
				toast.error(error instanceof Error ? error.message : "Failed to save rankings");
				return false;
			}
		},
		[originalOrders],
	);

	const handleSaveRankings = useCallback(
		async (position: Position) => {
			setIsSaving(true);
			try {
				const success = await saveRankingsForPosition(position);
				if (success) {
					await fetchPositions.current(true);
					toast.success(`Rankings saved for ${position.name}!`);
				} else {
					toast.error("Failed to save rankings");
				}
			} catch {
				toast.error("Failed to save rankings");
			} finally {
				setIsSaving(false);
			}
		},
		[saveRankingsForPosition],
	);

	return {
		positions,
		loading,
		isSaving,
		hasChanges,
		mounted,
		handleAddApplicant,
		handleRemoveApplicant,
		handleMoveApplicant,
		handleSaveRankings,
	};
}
