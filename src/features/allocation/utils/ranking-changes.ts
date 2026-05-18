export function detectRankingSelectionChanges(
	selectedIds: Set<number>,
	initialSelectedIds: Set<number>,
	selectedPositionIds: number[],
	initialRankingOrder: number[],
): boolean {
	const selectedIdsChanged =
		selectedIds.size !== initialSelectedIds.size ||
		[...selectedIds].some((id) => !initialSelectedIds.has(id));
	const rankingOrderChanged =
		JSON.stringify(selectedPositionIds) !== JSON.stringify(initialRankingOrder);
	return selectedIdsChanged || rankingOrderChanged;
}

export function buildRankingsPayload(
	positions: { id: number }[],
): { position_id: number; ranking: number }[] {
	return positions.map((p, i) => ({ position_id: p.id, ranking: i + 1 }));
}
