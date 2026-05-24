"use client";

import { cn } from "@/lib/utils";

interface VenueFilterProps {
  venues: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function VenueFilter({ venues, selected, onChange }: VenueFilterProps) {
  const allSelected = selected.length === 0;

  function toggle(venue: string) {
    if (selected.includes(venue)) {
      onChange(selected.filter((v) => v !== venue));
    } else {
      onChange([...selected, venue]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange([])}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          allSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        All
      </button>
      {venues.map((venue) => (
        <button
          key={venue}
          onClick={() => toggle(venue)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            selected.includes(venue)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {venue}
        </button>
      ))}
    </div>
  );
}
