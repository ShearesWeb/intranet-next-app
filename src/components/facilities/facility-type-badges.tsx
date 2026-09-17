"use client";

import { FacilityType, FACILITY_TYPE_CONFIG } from "@/types/facilities";
import { cn } from "@/lib/utils";
import { bookableFacilityTypes } from "@/lib/facilities/bookable-types";

interface FacilityTypeBadgesProps {
	value: FacilityType;
	onChange: (type: FacilityType) => void;
	types?: FacilityType[];
}

/** Pill toggle to switch the active facility type context. */
export function FacilityTypeBadges({
	value,
	onChange,
	types = bookableFacilityTypes(),
}: FacilityTypeBadgesProps) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{types.map((t) => {
				const cfg = FACILITY_TYPE_CONFIG[t];
				const active = value === t;
				return (
					<button
						key={t}
						type="button"
						onClick={() => onChange(t)}
						className={cn(
							"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95",
							active ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
						style={active ? { backgroundColor: cfg.color } : undefined}
					>
						{cfg.label}
					</button>
				);
			})}
		</div>
	);
}
