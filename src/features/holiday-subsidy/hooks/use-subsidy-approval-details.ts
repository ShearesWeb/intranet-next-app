"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	PositionOption,
	SubsidyDeclaration,
	SubsidyStatus,
	SubsidyWithPosition,
} from "@/features/holiday-subsidy/types/declarations";
import { SubsidyStatus as SubsidyStatusValues } from "@/features/holiday-subsidy/types/declarations";
import {
	buildPositionMap,
	mapSubsidyToDeclaration,
} from "@/features/holiday-subsidy/utils/declaration-mappers";

interface ApprovalDetailPayload {
	ccaName: string;
	positions?: PositionOption[];
	subsidies?: SubsidyWithPosition[];
}

interface UpdateInput {
	subsidyId: number;
	status: SubsidyStatus;
	rejectionReason?: string | null;
}

interface UpdateResponse {
	updated?: SubsidyWithPosition[];
}

export interface UseSubsidyApprovalDetailsResult {
	ccaName: string;
	declarations: SubsidyDeclaration[];
	loading: boolean;
	saving: boolean;
	error: string | null;
	pendingChangeCount: number;
	hasChanges: boolean;
	updateStatus: (declaration: SubsidyDeclaration, status: SubsidyStatus) => void;
	save: () => Promise<void>;
}

export function useSubsidyApprovalDetails(
	ccaId: string | null,
	initialCcaName: string,
): UseSubsidyApprovalDetailsResult {
	const [ccaName, setCcaName] = useState(initialCcaName);
	const [positions, setPositions] = useState<PositionOption[]>([]);
	const [declarations, setDeclarations] = useState<SubsidyDeclaration[]>([]);
	const [pendingChanges, setPendingChanges] = useState<Record<number, SubsidyStatus>>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const positionMap = useMemo(() => buildPositionMap(positions), [positions]);

	useEffect(() => {
		if (!ccaId) return;

		let isMounted = true;
		setLoading(true);
		setError(null);

		fetch(`/api/holidaySubsidy/approvals/${ccaId}`)
			.then(async (res) => {
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Failed to fetch subsidy approvals");
				}

				return data as ApprovalDetailPayload;
			})
			.then((data) => {
				if (!isMounted) return;

				const positionsData = data.positions ?? [];
				const map = buildPositionMap(positionsData);

				setCcaName(data.ccaName);
				setPositions(positionsData);
				setDeclarations(
					(data.subsidies || []).map((subsidy) => mapSubsidyToDeclaration(subsidy, map)),
				);
				setPendingChanges({});
			})
			.catch((err) => {
				if (!isMounted) return;
				setError(err instanceof Error ? err.message : "Failed to load subsidy approvals");
			})
			.finally(() => {
				if (!isMounted) return;
				setLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [ccaId]);

	const updateStatus = useCallback((declaration: SubsidyDeclaration, status: SubsidyStatus) => {
		setDeclarations((prev) =>
			prev.map((item) => (item.id === declaration.id ? { ...item, status } : item)),
		);
		setPendingChanges((prev) => ({ ...prev, [declaration.id]: status }));
	}, []);

	const pendingChangeCount = Object.keys(pendingChanges).length;
	const hasChanges = pendingChangeCount > 0;

	const save = useCallback(async () => {
		if (!hasChanges || !ccaId) return;

		setSaving(true);
		setError(null);

		try {
			const updates: UpdateInput[] = Object.entries(pendingChanges).map(([subsidyId, status]) => ({
				subsidyId: Number(subsidyId),
				status,
			}));

			const response = await fetch(`/api/holidaySubsidy/approvals/${ccaId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ updates }),
			});

			const data = (await response.json()) as UpdateResponse & { error?: string };

			if (!response.ok) {
				throw new Error(data.error || "Failed to save approvals");
			}

			const updated = data.updated ?? [];
			const updatedMap = new Map(updated.map((item) => [item.id, item.status] as const));

			setDeclarations((prev) =>
				prev.map((decl) => {
					const next = updatedMap.get(decl.id);
					if (!next) return decl;
					return { ...decl, status: (next as SubsidyStatus) ?? SubsidyStatusValues.PENDING };
				}),
			);
			setPendingChanges({});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save approvals");
		} finally {
			setSaving(false);
		}
	}, [ccaId, hasChanges, pendingChanges]);

	// positionMap is currently unused outside of seeding declarations but kept
	// for symmetry with other declaration consumers and future joins.
	void positionMap;

	return {
		ccaName,
		declarations,
		loading,
		saving,
		error,
		pendingChangeCount,
		hasChanges,
		updateStatus,
		save,
	};
}
