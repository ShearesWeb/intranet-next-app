"use client";

import { useEffect, useState } from "react";

export interface CcaApprovalRow {
	id: number;
	name: string;
	pendingDeclarations: number;
	pendingWeekly: number;
}

export function useSubsidyApprovalsIndex() {
	const [rows, setRows] = useState<CcaApprovalRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			try {
				setError(null);
				setLoading(true);
				const response = await fetch("/api/holiday-subsidy/approvals");
				if (!response.ok) throw new Error("Failed to load approvals");
				const json = await response.json();
				const payload = json.data ?? json;
				const ccas = payload.ccas as Array<{
					id: number;
					name: string;
					pendingDeclarations: number;
					pendingWeekly: number;
				}>;
				setRows(
					(ccas || []).map(({ id, name, pendingDeclarations, pendingWeekly }) => ({
						id,
						name,
						pendingDeclarations,
						pendingWeekly,
					})),
				);
			} catch (err) {
				console.error(err);
				setError("Unable to load subsidy approvals right now. Please try again.");
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { rows, loading, error };
}
