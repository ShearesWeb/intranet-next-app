"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { UserSearchResult } from "@/features/cca/types/members";

interface UseMemberSearchReturn {
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	searchResults: UserSearchResult[];
	searchLoading: boolean;
	searchUser: () => Promise<void>;
	clearSearch: () => void;
}

export function useMemberSearch(ccaId: string | null): UseMemberSearchReturn {
	const [searchQuery, setSearchQueryState] = useState("");
	const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);

	const setSearchQuery = useCallback((query: string) => {
		setSearchQueryState(query);
		if (query.trim().length < 2) {
			setSearchResults([]);
		}
	}, []);

	const clearSearch = useCallback(() => {
		setSearchQueryState("");
		setSearchResults([]);
	}, []);

	const searchUser = useCallback(async () => {
		const query = searchQuery.trim();
		if (!ccaId) {
			toast.error("CCA ID is required to search users");
			setSearchResults([]);
			return;
		}

		if (query.length < 2) {
			toast.error("Please enter at least 2 characters to search");
			setSearchResults([]);
			return;
		}

		setSearchLoading(true);
		try {
			const response = await fetch(
				`/api/cca/${ccaId}/search-users?query=${encodeURIComponent(query)}`,
			);
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to search users");
			}

			setSearchResults(json.data || []);
		} catch (error) {
			console.error("Error searching users:", error);
			const message = error instanceof Error ? error.message : "Failed to search users";
			toast.error(message);
			setSearchResults([]);
		} finally {
			setSearchLoading(false);
		}
	}, [ccaId, searchQuery]);

	return {
		searchQuery,
		setSearchQuery,
		searchResults,
		searchLoading,
		searchUser,
		clearSearch,
	};
}
