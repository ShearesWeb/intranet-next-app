"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AuthenticatedUser } from "@/types/user";

export interface ChairSubsidyRow {
	id: number;
	name: string;
	position_name: string;
	position_type: string;
}

const CHAIR_POSITION_TYPES = new Set(["lead", "vice"]);

export function useChairSubsidyCcas(user: AuthenticatedUser | null | undefined) {
	const [subsidyData, setSubsidyData] = useState<ChairSubsidyRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!user) {
			setLoading(false);
			setSubsidyData([]);
			return;
		}
		if (!user.appointments?.length) {
			setLoading(false);
			setSubsidyData([]);
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const chairCCAs = (user.appointments || [])
				.filter((appt) => CHAIR_POSITION_TYPES.has((appt.position_type || "").toLowerCase()))
				.map((appt) => ({
					id: appt.cca_id,
					name: appt.cca_name,
					position_name: appt.position_name,
					position_type: appt.position_type,
				}));
			setSubsidyData(chairCCAs);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to load CCAs";
			setError(message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	}, [user]);

	return { subsidyData, loading, error, hasChairAccess: subsidyData.length > 0 };
}
