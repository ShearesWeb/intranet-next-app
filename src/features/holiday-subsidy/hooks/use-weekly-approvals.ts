"use client";

import { useCallback, useEffect, useState } from "react";
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
	toggleSelected: (id: number) => void;

	// CCA display name
	ccaName: string;

	// State
	loading: boolean;
	isLoadingData: boolean;
	error: string | null;

	// Actions
	handleApprove: () => Promise<void>;
	handleReject: () => Promise<void>;
}

export function useWeeklyApprovals(
	ccaId: string | null,
	initialCcaName: string,
): UseWeeklyApprovalsResult {
	const [weekIndex, setWeekIndex] = useState(0);
	const [rows, setRows] = useState<WeeklyApprovalRow[]>([]);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [loading, setLoading] = useState(false);
	const [isLoadingData, setIsLoadingData] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [ccaName, setCcaName] = useState(initialCcaName);

	const weekInfo = HOLIDAY_WEEKS[weekIndex];

	// Fetch CCA display name from approvals endpoint
	useEffect(() => {
		if (!ccaId) return;

		let isMounted = true;

		fetch(`/api/holidaySubsidy/approvals/${ccaId}`)
			.then(async (res) => {
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Failed to fetch CCA details");
				}
				return data;
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
					`/api/holidaySubsidy/approvals/weekly/${ccaId}/${weekInfo.id}`,
				);

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.error || "Failed to load data");
				}

				const data = await response.json();
				setRows(data.submissions || []);
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

	const handleWeekChange = useCallback((newIndex: number) => {
		setWeekIndex(newIndex);
		setSelected(new Set());
	}, []);

	const runBatchUpdate = useCallback(
		async (status: WeeklyApprovalStatus, verb: "approve" | "reject") => {
			if (selected.size === 0) {
				toast.error(`Please select at least one member to ${verb}.`);
				return;
			}

			setLoading(true);
			try {
				const updates = rows
					.filter((row) => selected.has(row.id))
					.map((row) => ({
						userSubsidyId: row.user_subsidy_id,
						status,
					}));

				const response = await fetch(
					`/api/holidaySubsidy/approvals/weekly/${ccaId}/${weekInfo.id}`,
					{
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ updates }),
					},
				);

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.error || `Failed to ${verb}`);
				}

				setRows((prev) => prev.map((row) => (selected.has(row.id) ? { ...row, status } : row)));

				const verbPast = verb === "approve" ? "Approved" : "Rejected";
				toast.success(`${verbPast} ${selected.size} member(s).`);
				setSelected(new Set());
			} catch (err) {
				console.error(`Error ${verb}ing:`, err);
				toast.error(err instanceof Error ? err.message : `Failed to ${verb}. Please try again.`);
			} finally {
				setLoading(false);
			}
		},
		[ccaId, rows, selected, weekInfo.id],
	);

	const handleApprove = useCallback(() => runBatchUpdate("approved", "approve"), [runBatchUpdate]);
	const handleReject = useCallback(() => runBatchUpdate("rejected", "reject"), [runBatchUpdate]);

	return {
		weekIndex,
		weekInfo,
		handleWeekChange,
		rows,
		selected,
		toggleSelected,
		ccaName,
		loading,
		isLoadingData,
		error,
		handleApprove,
		handleReject,
	};
}
