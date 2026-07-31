"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useApiQuery } from "@/hooks/use-api-query";
import type { CCAData } from "@/types/cca-data";

export function useCcaList() {
	const { user } = useAuth();
	const { data, loading, error, refetch } = useApiQuery<CCAData[]>(
		"/api/user/ccas?includeAllAppointments=true",
		{
			enabled: Boolean(user?.appointments?.length),
			initialData: [],
			errorMessage: "Failed to fetch user CCA data",
			toastOnError: true,
		},
	);
	return { data: data ?? [], loading, error, refetch };
}
