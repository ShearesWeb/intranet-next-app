"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CCAData } from "@/types/cca-data";
import type { RecapData } from "@/types/recap";
import { buildRecapSlides } from "@/lib/ranking/recap-slides";
import type { AuthenticatedUser } from "@/types/user";

type UseRecapDataResult = {
	isMounted: boolean;
	ccas: CCAData[];
	loadingCcas: boolean;
	hasSeenRecap: boolean;
	setHasSeenRecap: (value: boolean | ((current: boolean) => boolean)) => void;
	recap: RecapData;
};

export function useRecapData(
	user: AuthenticatedUser,
	onSeenStateChange?: (hasSeenRecap: boolean) => void,
): UseRecapDataResult {
	const [loadingCcas, setLoadingCcas] = useState(Boolean(user.appointments?.length));
	const [ccas, setCcas] = useState<CCAData[]>([]);
	const [hasSeenRecap, setHasSeenRecapState] = useState(false);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
		const seen = localStorage.getItem("hasSeenPointsRecap");
		if (seen === "true") {
			setHasSeenRecapState(true);
		}
	}, []);

	useEffect(() => {
		onSeenStateChange?.(hasSeenRecap);
	}, [hasSeenRecap, onSeenStateChange]);

	useEffect(() => {
		let isActive = true;

		if (!user.appointments?.length) {
			setCcas([]);
			setLoadingCcas(false);
			return () => {
				isActive = false;
			};
		}

		const fallbackCcas: CCAData[] = user.appointments.map((appointment) => ({
			id: appointment.cca_id,
			name: appointment.cca_name,
			role: appointment.position_name,
			position_type: appointment.position_type,
			cca_kind: appointment.cca_kind,
			description: "",
			points: appointment.points || 0,
			team_status: null,
		}));

		setLoadingCcas(true);

		fetch("/api/user/ccas")
			.then(async (res) => {
				if (!res.ok) {
					throw new Error("Failed to fetch CCA recap data");
				}

				return res.json();
			})
			.then((data) => {
				if (!isActive) return;
				setCcas(Array.isArray(data.data) ? data.data : []);
			})
			.catch(() => {
				if (!isActive) return;
				setCcas(fallbackCcas);
			})
			.finally(() => {
				if (!isActive) return;
				setLoadingCcas(false);
			});

		return () => {
			isActive = false;
		};
	}, [user]);

	const setHasSeenRecap = useCallback((value: boolean | ((current: boolean) => boolean)) => {
		setHasSeenRecapState((current) => {
			const nextValue = typeof value === "function" ? value(current) : value;
			if (nextValue) {
				localStorage.setItem("hasSeenPointsRecap", "true");
			}
			return nextValue;
		});
	}, []);

	const recap = useMemo(() => buildRecapSlides(user, ccas), [ccas, user]);

	return {
		isMounted,
		ccas,
		loadingCcas,
		hasSeenRecap,
		setHasSeenRecap,
		recap,
	};
}
