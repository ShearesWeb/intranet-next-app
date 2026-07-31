"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";

/** CCAs the current user chairs (lead/vice), de-duplicated by CCA. */
export function useChairCcas() {
	const { user } = useAuth();

	const chairCcas = useMemo(() => {
		if (!user) return [];
		const seen = new Set<number>();
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.filter((a) => {
				if (seen.has(a.cca_id)) return false;
				seen.add(a.cca_id);
				return true;
			})
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	return { chairCcas, isChair: chairCcas.length > 0 };
}
