"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HOLIDAY_WEEKS } from "@/features/holiday-subsidy/utils/holiday-weeks";
import type {
	WeeklyApprovalRow,
	WeeklyApprovalStatus,
} from "@/features/holiday-subsidy/types/weekly";

export interface UseWeeklyApprovalsResult {
	// Week selection
	weekIndex: number;
	weekInfo: (typeof HOLIDAY_WEEKS)[number];
	handleWeekChange: (newIndex: number) => void;

	// Row + selection
	rows: WeeklyApprovalRow[];
	selected: Set<number>;
	pendingStatus: Map<number, WeeklyApprovalStatus>;
	toggleSelected: (id: number) => void;

	// CCA display name
	ccaName: string;

	// State
	saving: boolean;
	isLoadingData: boolean;
	error: string | null;
	hasChanges: boolean;

	// Actions
	stageApprove: () => void;
	stageReject: () => void;
	clearStaged: () => void;
	save: () => Promise<void>;
}

export function useWeeklyApprovals(
	ccaId: string | null,
	initialCcaName: string,
): UseWeeklyApprovalsResult {
	const [weekIndex, setWeekIndex] = useState(0);
	const [rows, setRows] = useState<WeeklyApprovalRow[]>([]);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [pendingStatus, setPendingStatus] = useState<Map<number, WeeklyApprovalStatus>>(new Map());
	const [saving, setSaving] = useState(false);
	const [isLoadingData, setIsLoadingData] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [ccaName, setCcaName] = useState(initialCcaName);

	const weekInfo = HOLIDAY_WEEKS[weekIndex];

	// Warn user before leaving page with unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (pendingStatus.size > 0) {
				e.preventDefault();
				e.returnValue = "";
				return "";
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [pendingStatus]);

	// Fetch CCA display name from approvals endpoint
	useEffect(() => {
		if (!ccaId) return;
		let isMounted = true;
		fetch(`/api/holiday-subsidy/approvals/${ccaId}`)
			.then(async (res) => {
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || "Failed to fetch CCA details");
				return json.data ?? json;
			})
			.then((data) => {
				if (!isMounted) return;
				setCcaName(data.ccaName || "Unknown CCA");
			})
			.catch((err) => {
				if (!isMounted) return;
				console.error("Error fetching CCA name:", err);
				setCcaName("Unknown CCA");
			});
		return () => {
			isMounted = false;
		};
	}, [ccaId]);

	// Fetch weekly submissions data when ccaId or week changes
	useEffect(() => {
		const fetchData = async () => {
			if (!ccaId) {
				setError("CCA ID is required");
				setIsLoadingData(false);
				return;
			}

			setIsLoadingData(true);
			setError(null);

			try {
				const response = await fetch(
					`/api/holiday-subsidy/approvals/weekly/${ccaId}/${weekInfo.id}`,
				);

				if (!response.ok) {
					const json = await response.json();
					throw new Error(json.error || "Failed to load data");
				}

				const json = await response.json();
				const payload = json.data ?? json;
				setRows(payload.submissions || []);
				setSelected(new Set());
				setPendingStatus(new Map());
			} catch (err) {
				console.error("Error fetching weekly approval data:", err);
				setError(err instanceof Error ? err.message : "Failed to load approval data");
			} finally {
				setIsLoadingData(false);
			}
		};

		fetchData();
	}, [ccaId, weekInfo.id]);

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
	}, []);

	const handleWeekChange = useCallback(
		(newIndex: number) => {
			if (pendingStatus.size > 0) {
				if (!confirm("You have unsaved changes. Discard them and switch weeks?")) return;
			}
			setWeekIndex(newIndex);
			setSelected(new Set());
			setPendingStatus(new Map());
		},
		[pendingStatus],
	);

	const stageStatus = useCallback(
		(status: WeeklyApprovalStatus, verb: "approve" | "reject") => {
			if (selected.size === 0) {
				toast.error(`Select at least one member to ${verb}.`);
				return;
			}
			setPendingStatus((prev) => {
				const next = new Map(prev);
				rows.forEach((row) => {
					if (!selected.has(row.id)) return;
					// If the new status matches what the server already has, drop the
					// pending entry — it's a no-op.
					if (row.status === status) {
						next.delete(row.id);
					} else {
						next.set(row.id, status);
					}
				});
				return next;
			});
			setSelected(new Set());
		},
		[rows, selected],
	);

	const stageApprove = useCallback(() => stageStatus("approved", "approve"), [stageStatus]);
	const stageReject = useCallback(() => stageStatus("rejected", "reject"), [stageStatus]);

	const clearStaged = useCallback(() => {
		setPendingStatus(new Map());
	}, []);

	const save = useCallback(async () => {
		if (pendingStatus.size === 0) {
			toast.error("No staged changes to save.");
			return;
		}

		setSaving(true);
		try {
			const updates = rows
				.filter((row) => pendingStatus.has(row.id))
				.map((row) => ({
					userSubsidyId: row.user_subsidy_id,
					status: pendingStatus.get(row.id)!,
				}));

			const response = await fetch(
				`/api/holiday-subsidy/approvals/weekly/${ccaId}/${weekInfo.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ updates }),
				},
			);

			if (!response.ok) {
				const json = await response.json();
				throw new Error(json.error || "Failed to save");
			}

			setRows((prev) =>
				prev.map((row) => {
					const next = pendingStatus.get(row.id);
					return next ? { ...row, status: next } : row;
				}),
			);
			toast.success(`Saved ${updates.length} change(s) for ${weekInfo.label}.`);
			setPendingStatus(new Map());
		} catch (err) {
			console.error("Error saving weekly approvals:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save. Please try again.");
		} finally {
			setSaving(false);
		}
	}, [ccaId, rows, pendingStatus, weekInfo.id, weekInfo.label]);

	const hasChanges = useMemo(() => pendingStatus.size > 0, [pendingStatus]);

	return {
		weekIndex,
		weekInfo,
		handleWeekChange,
		rows,
		selected,
		pendingStatus,
		toggleSelected,
		ccaName,
		saving,
		isLoadingData,
		error,
		hasChanges,
		stageApprove,
		stageReject,
		clearStaged,
		save,
	};
}
