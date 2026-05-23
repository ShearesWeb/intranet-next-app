"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	detectRankingSelectionChanges,
	buildRankingsPayload,
} from "@/features/allocation/utils/ranking-changes";
import type { RankablePosition } from "@/features/allocation/types/preferences";

export type RankStep = "selection" | "ranking";

export function useRankablePositions(userEmail: string | undefined) {
	const [allPositions, setAllPositions] = useState<RankablePosition[]>([]);
	const [selectedPositions, setSelectedPositions] = useState<RankablePosition[]>([]);
	const [loading, setLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [currentStep, setCurrentStep] = useState<RankStep>("selection");
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [initialSelectedIds, setInitialSelectedIds] = useState<Set<number>>(new Set());
	const [initialRankingOrder, setInitialRankingOrder] = useState<number[]>([]);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (!userEmail) return;

		const fetchRankablePositions = async () => {
			try {
				const response = await fetch(`/api/user/rankable-positions/${userEmail}`);
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to fetch rankable positions");
				}
				const json = await response.json();
				const positions = json.data?.positions || [];
				setAllPositions(positions);
				const preSelected = new Set<number>(
					positions
						.filter((p: RankablePosition) => p.is_selected)
						.map((p: RankablePosition) => p.id),
				);
				setSelectedIds(preSelected);
				setInitialSelectedIds(new Set(preSelected));

				if (preSelected.size > 0) {
					const selected = positions.filter((p: RankablePosition) => preSelected.has(p.id));
					selected.sort(
						(a: RankablePosition, b: RankablePosition) =>
							(a.user_ranking || 999) - (b.user_ranking || 999),
					);
					setSelectedPositions(selected);
					setInitialRankingOrder(selected.map((p: RankablePosition) => p.id));
					setCurrentStep("ranking");
				} else {
					setInitialRankingOrder([]);
				}

				setHasChanges(false);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Unknown error occurred");
			} finally {
				setLoading(false);
			}
		};

		fetchRankablePositions();
	}, [userEmail]);

	useEffect(() => {
		const changed = detectRankingSelectionChanges(
			selectedIds,
			initialSelectedIds,
			selectedPositions.map((p) => p.id),
			initialRankingOrder,
		);
		setHasChanges(changed);
	}, [selectedIds, initialSelectedIds, selectedPositions, initialRankingOrder]);

	const togglePositionSelection = useCallback((positionId: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(positionId)) {
				next.delete(positionId);
			} else {
				next.add(positionId);
			}
			return next;
		});
	}, []);

	const proceedToRanking = useCallback(() => {
		const selected = allPositions.filter((p) => selectedIds.has(p.id));
		selected.sort((a, b) => a.name.localeCompare(b.name));
		setSelectedPositions(selected);
		setCurrentStep("ranking");
	}, [allPositions, selectedIds]);

	const backToSelection = useCallback(() => {
		setCurrentStep("selection");
	}, []);

	const handleReorder = useCallback((newData: RankablePosition[]) => {
		setSelectedPositions(newData);
	}, []);

	const saveRankings = async () => {
		if (!userEmail) return;
		setIsSaving(true);
		try {
			const rankings = buildRankingsPayload(selectedPositions);
			const res = await fetch("/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: userEmail, rankings }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to save preferences");
			}
			toast.success("Preferences saved!");
			setInitialSelectedIds(new Set(selectedIds));
			setInitialRankingOrder(selectedPositions.map((p) => p.id));
			setHasChanges(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIsSaving(false);
		}
	};

	return {
		allPositions,
		selectedPositions,
		loading,
		isSaving,
		currentStep,
		selectedIds,
		hasChanges,
		togglePositionSelection,
		proceedToRanking,
		backToSelection,
		handleReorder,
		saveRankings,
	};
}
