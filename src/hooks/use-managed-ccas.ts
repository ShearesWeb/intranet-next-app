"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useApiQuery } from "@/hooks/use-api-query";
import type { CCAData } from "@/types/cca-data";

export function useManagedCcas() {
	const { user } = useAuth();
	const { data, loading, error, refetch } = useApiQuery<CCAData[]>("/api/user/managed-ccas", {
		enabled: Boolean(user?.appointments?.length),
		initialData: [],
		errorMessage: "Failed to fetch managed CCA data",
		toastOnError: true,
	});
	return { data: data ?? [], loading, error, refetch };
}
