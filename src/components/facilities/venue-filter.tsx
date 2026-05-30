"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

interface VenueFilterProps {
  venues: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function VenueFilter({ venues, selected, onChange }: VenueFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = venues.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase()),
  );

  const label =
    selected.length === 0
      ? "All Venues"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} venues`;

  function toggle(venue: string) {
    if (selected.includes(venue)) {
      onChange(selected.filter((v) => v !== venue));
    } else {
      onChange([...selected, venue]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
          selected.length > 0
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-foreground hover:bg-accent",
        )}
      >
        <span className="max-w-[160px] truncate">{label}</span>
        {selected.length > 0 ? (
          <X
            className="h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-popover p-1 shadow-md">
          <div className="flex items-center gap-2 border-b px-2 pb-1.5 mb-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venues..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
            <button
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-sm",
                selected.length === 0
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-accent",
              )}
            >
              All Venues
            </button>

            {filtered.map((venue) => (
              <button
                key={venue}
                onClick={() => toggle(venue)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  selected.includes(venue)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    selected.includes(venue)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {selected.includes(venue) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="truncate">{venue}</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No venues match &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
