"use client";

import { FacilitySlotWithClaims } from "@/types/facilities";
import { SlotCard } from "./slot-card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface DayDetailPanelProps {
  date: string;
  slots: FacilitySlotWithClaims[];
  isChair: boolean;
  onClaim: (slot: FacilitySlotWithClaims) => void;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function DayDetailPanel({ date, slots, isChair, onClaim }: DayDetailPanelProps) {
  const grouped = new Map<string, FacilitySlotWithClaims[]>();
  for (const slot of slots) {
    const key = `${slot.venue} — ${slot.sub_venue}`;
    const list = grouped.get(key) ?? [];
    list.push(slot);
    grouped.set(key, list);
  }

  const venueGroups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex-1 min-w-0">
      <h3 className="mb-4 text-lg font-semibold">{formatDisplayDate(date)}</h3>

      {venueGroups.length === 0 && (
        <p className="text-sm text-muted-foreground">No available slots on this day.</p>
      )}

      <div className="space-y-3">
        {venueGroups.map(([venue, venueSlots]) => (
          <VenueGroup
            key={venue}
            venue={venue}
            slots={venueSlots}
            isChair={isChair}
            onClaim={onClaim}
          />
        ))}
      </div>
    </div>
  );
}

function VenueGroup({
  venue,
  slots,
  isChair,
  onClaim,
}: {
  venue: string;
  slots: FacilitySlotWithClaims[];
  isChair: boolean;
  onClaim: (slot: FacilitySlotWithClaims) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent">
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span>{venue}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {slots.length} slot{slots.length !== 1 ? "s" : ""}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1.5 pl-6">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isChair={isChair}
              onClaim={onClaim}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
