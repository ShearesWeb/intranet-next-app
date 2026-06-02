"use client";

import { useMemo } from "react";
import type { AuthenticatedUser } from "@/types/user";

export interface ChairSubsidyRow {
	id: number;
	name: string;
	position_name: string;
	position_type: string;
}

const CHAIR_POSITION_TYPES = new Set(["lead", "vice"]);

export function useChairSubsidyCcas(user: AuthenticatedUser | null | undefined) {
	const subsidyCcas = useMemo(() => {
		if (!user?.appointments?.length) return [];

		return user.appointments
			.filter((appt) => CHAIR_POSITION_TYPES.has((appt.position_type || "").toLowerCase()))
			.map((appt) => ({
				id: appt.cca_id,
				name: appt.cca_name,
				position_name: appt.position_name,
				position_type: appt.position_type,
			}));
	}, [user]);

	return {
		subsidyData: subsidyCcas,
		loading: false,
		error: null,
		hasChairAccess: subsidyCcas.length > 0,
	};
}
