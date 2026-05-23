"use client";

import React from "react";
import { Plus, Search, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { UserSearchResult } from "@/features/cca/types/members";

interface AddApplicantDialogProps {
	onAddApplicant: (user: UserSearchResult) => void;
	excludedIds?: number[];
}

export function AddApplicantDialog({ onAddApplicant, excludedIds = [] }: AddApplicantDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [results, setResults] = React.useState<UserSearchResult[]>([]);
	const [searching, setSearching] = React.useState(false);
	const [touched, setTouched] = React.useState(false);

	React.useEffect(() => {
		if (!open) {
			setQuery("");
			setResults([]);
			setTouched(false);
			return;
		}
	}, [open]);

	React.useEffect(() => {
		if (!open) return;
		const q = query.trim();
		if (q.length < 2) {
			setResults([]);
			return;
		}
		setTouched(true);
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			setSearching(true);
			try {
				const res = await fetch(`/api/user/search?query=${encodeURIComponent(q)}`, {
					signal: controller.signal,
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
				setResults(data.data || []);
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				toast.error(err instanceof Error ? err.message : "Search failed");
				setResults([]);
			} finally {
				setSearching(false);
			}
		}, 220);

		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [query, open]);

	const handleSelect = (user: UserSearchResult) => {
		onAddApplicant(user);
		setOpen(false);
	};

	const excluded = new Set(excludedIds);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="gap-2">
					<Plus className="h-4 w-4" />
					Add applicant
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add an applicant</DialogTitle>
					<DialogDescription>
						Search by name, email, or room. Click a result to add them to this position.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						autoFocus
						placeholder="Search users…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<div className="min-h-[200px] max-h-[320px] overflow-y-auto rounded-md border">
					{searching ? (
						<div className="flex h-[200px] items-center justify-center text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Searching…
						</div>
					) : query.trim().length < 2 ? (
						<div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
							<UserPlus className="h-8 w-8 opacity-40" />
							<div className="text-sm">Type at least 2 characters to search</div>
						</div>
					) : results.length === 0 && touched ? (
						<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
							No users matched &ldquo;{query}&rdquo;
						</div>
					) : (
						<ul className="divide-y">
							{results.map((user) => {
								const isExcluded = excluded.has(user.id);
								return (
									<li
										key={user.id}
										className="flex items-center justify-between gap-3 px-4 py-3"
									>
										<div className="min-w-0">
											<div className="truncate font-medium">{user.name}</div>
											<div className="truncate text-sm text-muted-foreground">
												{user.email}
												{user.room ? ` · Room ${user.room}` : ""}
											</div>
										</div>
										{isExcluded ? (
											<span className="flex-shrink-0 text-xs font-medium text-muted-foreground">
												Already added
											</span>
										) : (
											<Button
												size="sm"
												onClick={() => handleSelect(user)}
												className="flex-shrink-0 gap-1.5"
											>
												<Plus className="h-4 w-4" />
												Add
											</Button>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
