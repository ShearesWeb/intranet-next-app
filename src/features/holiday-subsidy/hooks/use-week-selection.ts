"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { HOLIDAY_WEEKS, getEditableWeekIds } from "@/features/holiday-subsidy/utils/holiday-weeks";

export interface UseWeekSelectionOptions {
	hasUnsavedChanges: boolean;
	onWeekChange: () => void;
}

export interface UseWeekSelectionResult {
	weekIndex: number;
	editableWeekIds: number[];
	weekInfo: (typeof HOLIDAY_WEEKS)[number];
	isWeekOpen: boolean;
	handleWeekChange: (newIndex: number) => void;
}

export function useWeekSelection(options: UseWeekSelectionOptions): UseWeekSelectionResult {
	const { hasUnsavedChanges, onWeekChange } = options;

	const [editableWeekIds, setEditableWeekIds] = useState<number[]>(() =>
		getEditableWeekIds(new Date()),
	);
	const [weekIndex, setWeekIndex] = useState(() => {
		const initialIndex = HOLIDAY_WEEKS.findIndex((week) =>
			getEditableWeekIds(new Date()).includes(week.id),
		);
		return initialIndex >= 0 ? initialIndex : 0;
	});

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

	const handleWeekChange = useCallback(
		(newIndex: number) => {
			if (!editableWeekIds.includes(HOLIDAY_WEEKS[newIndex]?.id)) {
				toast.error("Weekly declarations are closed for this week.");
				return;
			}

			if (hasUnsavedChanges) {
				if (confirm("You have unsaved changes. Do you want to discard them?")) {
					setWeekIndex(newIndex);
					onWeekChange();
				}
			} else {
				setWeekIndex(newIndex);
				onWeekChange();
			}
		},
		[editableWeekIds, hasUnsavedChanges, onWeekChange],
	);

	return {
		weekIndex,
		editableWeekIds,
		weekInfo,
		isWeekOpen,
		handleWeekChange,
	};
}
