// Pure helpers that drive the "save" / "has changes" buttons on the chair
// weekly-commitment page. The local WeeklyRow shape here intentionally subsets
// the feature-level type (`@/features/holiday-subsidy/types/weekly`) — only
// the fields these helpers read need to be present.

export interface WeeklyRow {
	id: number;
	user_id: number;
	position_id: number;
	override_hours: number | null;
	comments: string;
	submitted: boolean;
}

export interface WeeklyDeclaration {
	user_id: number;
	position_id: number;
	// NULL → inherit envelope rate (cca_user_subsidies.hours is nullable).
	hours: number | null;
	// Chair's per-member note; NULL → no comment.
	comments: string | null;
}

export interface WeeklyDeletion {
	user_id: number;
	position_id: number;
}

export interface WeeklySavePayload {
	declarations: WeeklyDeclaration[];
	deletions: WeeklyDeletion[];
}

export function getCanSave(
	rows: WeeklyRow[],
	selected: Set<number>,
	dirtyRows: Set<number>,
): boolean {
	const selectedDirtyOrNew = rows.some(
		(row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted),
	);
	const deselectedSubmitted = rows.some((row) => !selected.has(row.id) && row.submitted);
	return selectedDirtyOrNew || deselectedSubmitted;
}

export function getHasPendingChanges(
	rows: WeeklyRow[],
	selected: Set<number>,
	dirtyRows: Set<number>,
): boolean {
	const selectedDirtyOrNew = rows.some(
		(row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted),
	);
	const deselectedSubmitted = rows.some((row) => !selected.has(row.id) && row.submitted);
	const anyDirty = rows.some((row) => dirtyRows.has(row.id));
	return selectedDirtyOrNew || anyDirty || deselectedSubmitted;
}

export function buildSavePayload(
	rows: WeeklyRow[],
	selected: Set<number>,
	dirtyRows: Set<number>,
): WeeklySavePayload {
	const selectedDirtyRows = rows.filter(
		(row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted),
	);
	const deselectedSubmittedRows = rows.filter((row) => !selected.has(row.id) && row.submitted);

	const declarations: WeeklyDeclaration[] = selectedDirtyRows.map((row) => ({
		user_id: row.user_id,
		position_id: row.position_id,
		hours: row.override_hours,
		comments: row.comments || null,
	}));
	const deletions: WeeklyDeletion[] = deselectedSubmittedRows.map((row) => ({
		user_id: row.user_id,
		position_id: row.position_id,
	}));

	return { declarations, deletions };
}
