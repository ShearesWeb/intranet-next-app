"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { UserSearchResult } from "@/features/cca/types/members";

interface PositionSearchBoxProps {
	onAddApplicant: (userData: UserSearchResult) => void;
}

export function PositionSearchBox({ onAddApplicant }: PositionSearchBoxProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
	const [isUserFocused, setIsUserFocused] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [isSearching, setIsSearching] = useState(false);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsUserFocused(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleFocus = useCallback(() => {
		setIsUserFocused(true);
	}, []);

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			if (isUserFocused && !e.relatedTarget) {
				setTimeout(() => {
					if (inputRef.current && isUserFocused) inputRef.current.focus();
				}, 10);
			}
		},
		[isUserFocused],
	);

	const handleSearch = useCallback(async () => {
		if (searchTerm.length < 2) {
			setSearchResults([]);
			return;
		}
		setIsSearching(true);
		try {
			const res = await fetch(`/api/user/search?query=${encodeURIComponent(searchTerm)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || `HTTP error: ${res.status}`);
			setSearchResults(data.data || []);
		} catch (error) {
			console.error("Search error:", error);
			setSearchResults([]);
			toast.error(error instanceof Error ? error.message : "Search failed. Please try again.");
		} finally {
			setIsSearching(false);
		}
	}, [searchTerm]);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
		if (e.target.value.length < 2) setSearchResults([]);
	}, []);

	const handleResultClick = useCallback(
		(userData: UserSearchResult) => {
			onAddApplicant(userData);
			if (inputRef.current) {
				inputRef.current.value = "";
				setSearchTerm("");
				inputRef.current.focus();
			}
			setSearchResults([]);
		},
		[onAddApplicant],
	);

	return (
		<div ref={containerRef} className="relative mb-2">
			<div className="flex gap-2 items-center">
				<Input
					ref={inputRef}
					type="text"
					placeholder="Search user by name/email/room"
					value={searchTerm}
					onChange={handleInputChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyPress={(e) => e.key === "Enter" && !isSearching && handleSearch()}
					autoComplete="off"
					disabled={isSearching}
					className="flex"
				/>
				<Button
					onClick={handleSearch}
					disabled={searchTerm.length < 2 || isSearching}
					className="gap-2 flex-shrink-0"
				>
					{isSearching ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading...
						</>
					) : (
						<>
							<Search className="h-4 w-4" />
							Search
						</>
					)}
				</Button>
			</div>
			{searchResults.length > 0 && (
				<div className="absolute mt-1 top-full bg-background border rounded-md shadow-lg z-10 max-h-[200px] overflow-y-auto">
					{searchResults.map((user) => (
						<div
							key={user.id}
							className="p-2 cursor-pointer border-b last:border-b-0 hover:bg-accent transition-colors"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => handleResultClick(user)}
						>
							{user.name} ({user.email}
							{user.room ? `, Room ${user.room}` : ""})
						</div>
					))}
				</div>
			)}
		</div>
	);
}
