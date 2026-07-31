"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseApiQueryOptions<T> {
	/** When false, skip fetching and reset to `initialData`. */
	enabled?: boolean;
	initialData?: T;
	/** Map the response envelope to the hook's data. Defaults to `json.data ?? json`. */
	select?: (json: unknown) => T;
	errorMessage?: string;
	toastOnError?: boolean;
}

interface UseApiQueryReturn<T> {
	data: T | undefined;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

/**
 * Read-only fetch against an internal API route, with the loading/error/refetch
 * state machine every list page needs. Refetches when `url` or `enabled` change.
 */
export function useApiQuery<T>(
	url: string,
	options: UseApiQueryOptions<T> = {},
): UseApiQueryReturn<T> {
	const { enabled = true, errorMessage = "Failed to load data", toastOnError = false } = options;
	const initialDataRef = useRef(options.initialData);
	const selectRef = useRef(options.select);
	selectRef.current = options.select;

	const [data, setData] = useState<T | undefined>(initialDataRef.current);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refetch = useCallback(async () => {
		if (!enabled) {
			setData(initialDataRef.current);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const res = await fetch(url);
			const json: unknown = await res.json();
			if (!res.ok) {
				throw new Error((json as { error?: string })?.error || errorMessage);
			}
			const select = selectRef.current;
			setData(select ? select(json) : (((json as { data?: T }).data ?? json) as T));
		} catch (err) {
			const message = err instanceof Error ? err.message : errorMessage;
			console.error(`Error fetching ${url}:`, message);
			if (toastOnError) toast.error(message);
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [url, enabled, errorMessage, toastOnError]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return { data, loading, error, refetch };
}
