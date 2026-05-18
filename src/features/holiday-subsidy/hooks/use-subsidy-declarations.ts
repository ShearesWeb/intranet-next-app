"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	PositionOption,
	SubsidyDeclaration,
	SubsidyWithPosition,
} from "@/features/holiday-subsidy/types/declarations";
import {
	buildPositionMap,
	mapSubsidyToDeclaration,
} from "@/features/holiday-subsidy/utils/declaration-mappers";

export interface UseSubsidyDeclarationsResult {
	positions: PositionOption[];
	declarations: SubsidyDeclaration[];
	loading: boolean;
	error: string | null;
	dialogOpen: boolean;
	editingDeclaration: SubsidyDeclaration | null;
	openCreateDialog: () => void;
	openEditDialog: (declaration: SubsidyDeclaration) => void;
	handleDialogOpenChange: (open: boolean) => void;
	handleDelete: (declaration: SubsidyDeclaration) => Promise<void>;
	handleDeclarationSaved: (declaration: SubsidyDeclaration, isEdit: boolean) => void;
	mapApiSubsidy: (
		subsidy: SubsidyWithPosition,
		overrideMap?: Map<number, PositionOption>,
	) => SubsidyDeclaration;
}

export function useSubsidyDeclarations(ccaId: string | null): UseSubsidyDeclarationsResult {
	const [positions, setPositions] = useState<PositionOption[]>([]);
	const [declarations, setDeclarations] = useState<SubsidyDeclaration[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingDeclaration, setEditingDeclaration] = useState<SubsidyDeclaration | null>(null);

	const positionMap = useMemo(() => buildPositionMap(positions), [positions]);

	const mapApiSubsidy = useCallback(
		(
			subsidy: SubsidyWithPosition,
			overrideMap?: Map<number, PositionOption>,
		): SubsidyDeclaration => {
			return mapSubsidyToDeclaration(subsidy, overrideMap ?? positionMap);
		},
		[positionMap],
	);

	useEffect(() => {
		if (!ccaId) {
			return;
		}

		let isMounted = true;
		setLoading(true);
		setError(null);

		fetch(`/api/holidaySubsidy/declarations/${ccaId}`)
			.then(async (res) => {
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Failed to fetch subsidy declarations");
				}

				return data as { positions?: PositionOption[]; subsidies?: SubsidyWithPosition[] };
			})
			.then((data) => {
				if (!isMounted) return;

				const positionsData = data.positions ?? [];
				const map = buildPositionMap(positionsData);

				setPositions(positionsData);
				setDeclarations(
					(data.subsidies || []).map((subsidy) => mapSubsidyToDeclaration(subsidy, map)),
				);
			})
			.catch((err) => {
				if (!isMounted) return;
				setError(err instanceof Error ? err.message : "Failed to load subsidy declarations");
			})
			.finally(() => {
				if (!isMounted) return;
				setLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [ccaId]);

	const handleDialogOpenChange = useCallback((open: boolean) => {
		setDialogOpen(open);
		if (!open) setEditingDeclaration(null);
	}, []);

	const openCreateDialog = useCallback(() => {
		setEditingDeclaration(null);
		setDialogOpen(true);
	}, []);

	const openEditDialog = useCallback((declaration: SubsidyDeclaration) => {
		setEditingDeclaration(declaration);
		setDialogOpen(true);
	}, []);

	const handleDelete = useCallback(
		async (declaration: SubsidyDeclaration) => {
			if (!ccaId) return;
			if (!confirm("Are you sure you want to delete this declaration?")) return;

			try {
				const response = await fetch(`/api/holidaySubsidy/declarations/${ccaId}`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ subsidyId: declaration.id }),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to delete declaration");
				}

				setDeclarations((prev) => prev.filter((item) => item.id !== declaration.id));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to delete declaration");
			}
		},
		[ccaId],
	);

	const handleDeclarationSaved = useCallback((declaration: SubsidyDeclaration, isEdit: boolean) => {
		setDeclarations((prev) =>
			isEdit
				? prev.map((item) => (item.id === declaration.id ? declaration : item))
				: [declaration, ...prev],
		);
	}, []);

	return {
		positions,
		declarations,
		loading,
		error,
		dialogOpen,
		editingDeclaration,
		openCreateDialog,
		openEditDialog,
		handleDialogOpenChange,
		handleDelete,
		handleDeclarationSaved,
		mapApiSubsidy,
	};
}
