import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/auth-context";
import type { CCAData } from "@/features/cca/types/cca-data";

interface UseManagedCcasReturn {
	data: CCAData[];
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export function useManagedCcas(): UseManagedCcasReturn {
	const { user } = useAuth();
	const [data, setData] = useState<CCAData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refetch = useCallback(async () => {
		if (!user || !user.appointments?.length) {
			setData([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/user/managed-ccas");
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || "Failed to fetch managed CCA data");
			}

			const json = await res.json();
			setData(json.data as CCAData[]);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to fetch managed CCA data";
			console.error("Error fetching CCAs:", message);
			toast.error(message);
			setError("Failed to load CCAs");
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return { data, loading, error, refetch };
}
