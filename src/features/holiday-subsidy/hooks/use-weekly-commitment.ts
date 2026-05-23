"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HOLIDAY_WEEKS, getEditableWeekIds } from "@/features/holiday-subsidy/utils/holiday-weeks";
import type { WeeklyRow } from "@/features/holiday-subsidy/types/weekly";

export interface UseWeeklyCommitmentResult {
	// Week selection
	weekIndex: number;
	editableWeekIds: number[];
	weekInfo: (typeof HOLIDAY_WEEKS)[number];
	isWeekOpen: boolean;
	handleWeekChange: (newIndex: number) => void;

	// Row data
	rows: WeeklyRow[];
	selected: Set<number>;
	dirtyRows: Set<number>;
	toggleSelected: (id: number) => void;
	handleChange: (id: number, key: keyof WeeklyRow, value: string | number | null) => void;

	// Save state
	isLoading: boolean;
	isSaving: boolean;
	canSave: boolean;
	hasUnsavedChanges: boolean;
	error: string | null;
	handleSave: () => Promise<void>;
}

export function useWeeklyCommitment(ccaId: string | null): UseWeeklyCommitmentResult {
	const [editableWeekIds, setEditableWeekIds] = useState<number[]>(() =>
		getEditableWeekIds(new Date()),
	);
	const [weekIndex, setWeekIndex] = useState(() => {
		const initialIndex = HOLIDAY_WEEKS.findIndex((week) =>
			getEditableWeekIds(new Date()).includes(week.id),
		);
		return initialIndex >= 0 ? initialIndex : 0;
	});
	const [rows, setRows] = useState<WeeklyRow[]>([]);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
	const [isSaving, setIsSaving] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const weekInfo = HOLIDAY_WEEKS[weekIndex];
	const isWeekOpen = editableWeekIds.includes(weekInfo.id);

	// Re-evaluate editable weeks every minute so the UI updates around the grace
	// deadline without requiring a refresh.
	useEffect(() => {
		const interval = setInterval(() => {
			setEditableWeekIds(getEditableWeekIds(new Date()));
		}, 60000);

		return () => clearInterval(interval);
	}, []);

	// If the currently selected tab becomes uneditable (e.g. grace window closed
	// while the user is on the page), snap to the first editable week.
	useEffect(() => {
		setWeekIndex((currentIndex) => {
			if (editableWeekIds.includes(HOLIDAY_WEEKS[currentIndex]?.id)) {
				return currentIndex;
			}

			const nextIndex = HOLIDAY_WEEKS.findIndex((week) => editableWeekIds.includes(week.id));
			return nextIndex >= 0 ? nextIndex : currentIndex;
		});
	}, [editableWeekIds]);

	// Fetch data when component mounts or week changes
	useEffect(() => {
		const fetchData = async () => {
			if (!ccaId) {
				setError("CCA ID is required");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				if (!isWeekOpen) {
					setRows([]);
					setHasUnsavedChanges(false);
					setSelected(new Set());
					setDirtyRows(new Set());
					setIsLoading(false);
					return;
				}

				const response = await fetch(`/api/holiday-subsidy/weekly/${ccaId}/${weekInfo.id}`);

				if (!response.ok) {
					const json = await response.json();
					throw new Error(json.error || "Failed to load data");
				}

				const json = await response.json();
				const payload = json.data ?? json;
				const fetchedRows: WeeklyRow[] = payload.members || [];
				setRows(fetchedRows);
				setSelected(
					new Set(fetchedRows.filter((member) => member.submitted).map((member) => member.id)),
				);
				setDirtyRows(new Set());
				setHasUnsavedChanges(false);
			} catch (err) {
				console.error("Error fetching weekly data:", err);
				setError(err instanceof Error ? err.message : "Failed to load weekly commitment data");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [ccaId, isWeekOpen, weekInfo.id]);

	// Warn user before leaving page with unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges) {
				e.preventDefault();
				e.returnValue = "";
				return "";
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasUnsavedChanges]);

	const handleChange = useCallback(
		(id: number, key: keyof WeeklyRow, value: string | number | null) => {
			setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
			setDirtyRows((prev) => {
				const next = new Set(prev);
				next.add(id);
				return next;
			});
		},
		[],
	);

	const { canSave, hasPendingChanges } = useMemo(() => {
		const selectedDirtyOrNew = rows.some(
			(row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted),
		);
		const deselectedSubmitted = rows.some((row) => !selected.has(row.id) && row.submitted);
		const anyDirty = rows.some((row) => dirtyRows.has(row.id));

		return {
			canSave: selectedDirtyOrNew || deselectedSubmitted,
			hasPendingChanges: selectedDirtyOrNew || anyDirty || deselectedSubmitted,
		};
	}, [rows, selected, dirtyRows]);

	useEffect(() => {
		setHasUnsavedChanges(hasPendingChanges);
	}, [hasPendingChanges]);

	const toggleSelected = useCallback((id: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
		setHasUnsavedChanges(true);
	}, []);

	const handleSave = useCallback(async () => {
		if (!ccaId) {
			toast.error("CCA ID is required");
			return;
		}

		const selectedDirtyRows = rows.filter(
			(row) => selected.has(row.id) && (dirtyRows.has(row.id) || !row.submitted),
		);
		const deselectedSubmittedRows = rows.filter((row) => !selected.has(row.id) && row.submitted);

		if (selectedDirtyRows.length === 0 && deselectedSubmittedRows.length === 0) {
			toast.error("No changes to save. Select members or update their details.");
			return;
		}

		setIsSaving(true);
		try {
			const declarations = selectedDirtyRows.map((row) => ({
				user_id: row.user_id,
				position_id: row.position_id,
				// Send the per-user `hours` only when it differs from the
				// envelope rate; passing the envelope rate verbatim is
				// equivalent to "no override". Null tells the RPC to
				// inherit the envelope.
				hours: row.override_hours !== null ? row.override_hours : null,
				comments: row.comments || null,
			}));
			const deletions = deselectedSubmittedRows.map((row) => ({
				user_id: row.user_id,
				position_id: row.position_id,
			}));

			const response = await fetch(`/api/holiday-subsidy/weekly/${ccaId}/${weekInfo.id}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ declarations, deletions }),
			});

			if (!response.ok) {
				const json = await response.json();
				throw new Error(json.error || "Failed to save");
			}

			const json = await response.json();
			const savePayload = json.data ?? json;
			toast.success(savePayload.message || "Changes saved successfully!");

			const updatedRows = rows.map((row) => {
				const wasSaved = selectedDirtyRows.some(
					(saved) => saved.user_id === row.user_id && saved.position_id === row.position_id,
				);
				const wasDeleted = deselectedSubmittedRows.some(
					(del) => del.user_id === row.user_id && del.position_id === row.position_id,
				);

				if (wasDeleted) {
					return { ...row, submitted: false };
				}

				if (wasSaved) {
					return { ...row, submitted: true };
				}

				return row;
			});
			setRows(updatedRows);

			const remainingDirtyRows = (() => {
				const next = new Set(dirtyRows);
				selectedDirtyRows.forEach((row) => next.delete(row.id));
				return next;
			})();
			setDirtyRows(remainingDirtyRows);
			setHasUnsavedChanges(remainingDirtyRows.size > 0);
		} catch (err) {
			console.error("Error saving:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save changes. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}, [ccaId, rows, selected, dirtyRows, weekInfo.id]);

	const handleWeekChange = useCallback(
		(newIndex: number) => {
			if (!editableWeekIds.includes(HOLIDAY_WEEKS[newIndex]?.id)) {
				toast.error("Weekly declarations are closed for this week.");
				return;
			}

			if (hasUnsavedChanges) {
				if (confirm("You have unsaved changes. Do you want to discard them?")) {
					setWeekIndex(newIndex);
					setHasUnsavedChanges(false);
					setSelected(new Set());
					setDirtyRows(new Set());
				}
			} else {
				setWeekIndex(newIndex);
				setSelected(new Set());
				setDirtyRows(new Set());
			}
		},
		[editableWeekIds, hasUnsavedChanges],
	);

	return {
		weekIndex,
		editableWeekIds,
		weekInfo,
		isWeekOpen,
		handleWeekChange,
		rows,
		selected,
		dirtyRows,
		toggleSelected,
		handleChange,
		isLoading,
		isSaving,
		canSave,
		hasUnsavedChanges,
		error,
		handleSave,
	};
}
