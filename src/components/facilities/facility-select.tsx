"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { Facility } from "@/types/facilities";
import { groupFacilitiesByType } from "@/lib/facilities/facility-picker";

interface FacilitySelectProps {
	facilities: Facility[];
	value: number | null;
	onChange: (id: number) => void;
	placeholder?: string;
}

/** Single-select facility dropdown with a search bar, options grouped by type. */
export function FacilitySelect({
	facilities,
	value,
	onChange,
	placeholder = "Select facility…",
}: FacilitySelectProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	const groups = groupFacilitiesByType(facilities, search);
	const selected = facilities.find((f) => f.id === value) ?? null;

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"flex w-full items-center justify-between gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:bg-accent",
					selected ? "text-foreground" : "text-muted-foreground",
				)}
			>
				<span className="truncate">{selected ? selected.sub_venue : placeholder}</span>
				<ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
			</button>

			{open && (
				<div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
					<div className="mb-1 flex items-center gap-2 border-b px-2 pb-1.5">
						<Search className="h-3.5 w-3.5 text-muted-foreground" />
						<input
							autoFocus
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search facilities..."
							className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>

					<div className="max-h-56 overflow-y-auto">
						{groups.length === 0 ? (
							<p className="px-2 py-3 text-center text-xs text-muted-foreground">
								No facilities match &ldquo;{search}&rdquo;
							</p>
						) : (
							groups.map((g) => (
								<div key={g.type}>
									<div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
										<span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
										{g.label}
									</div>
									{g.facilities.map((f) => (
										<button
											key={f.id}
											type="button"
											onClick={() => {
												onChange(f.id);
												setSearch("");
												setOpen(false);
											}}
											className={cn(
												"flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
												value === f.id
													? "bg-primary/10 font-medium text-primary"
													: "text-foreground hover:bg-accent",
											)}
										>
											<span className="truncate">{f.sub_venue}</span>
											{f.venue !== f.sub_venue && (
												<span className="truncate text-[10px] text-muted-foreground">{f.venue}</span>
											)}
										</button>
									))}
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
