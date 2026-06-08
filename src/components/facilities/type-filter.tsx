"use client";

import { cn } from "@/lib/utils";
import { BookingType, BOOKING_TYPE_CONFIG } from "@/types/facilities";

interface TypeFilterProps {
	selected: BookingType[];
	onChange: (selected: BookingType[]) => void;
}

const TYPES = Object.keys(BOOKING_TYPE_CONFIG) as BookingType[];

export function TypeFilter({ selected, onChange }: TypeFilterProps) {
	const allSelected = selected.length === 0;

	function toggle(type: BookingType) {
		if (selected.includes(type)) {
			onChange(selected.filter((t) => t !== type));
		} else {
			onChange([...selected, type]);
		}
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			<button
				onClick={() => onChange([])}
				className={cn(
					"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
					allSelected
						? "bg-primary text-primary-foreground shadow-sm"
						: "bg-muted text-muted-foreground hover:bg-muted/80",
				)}
			>
				All Types
			</button>
			{TYPES.map((type) => {
				const config = BOOKING_TYPE_CONFIG[type];
				const isActive = selected.includes(type);
				return (
					<button
						key={type}
						onClick={() => toggle(type)}
						className={cn(
							"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
							isActive
								? "text-white shadow-sm"
								: "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
						style={isActive ? { backgroundColor: config.color } : undefined}
					>
						<span
							className={cn(
								"mr-1.5 inline-block h-2 w-2 rounded-full border",
								isActive ? "border-white bg-transparent" : "border-transparent",
							)}
							style={isActive ? undefined : { backgroundColor: config.color }}
						/>
						{config.label}
					</button>
				);
			})}
		</div>
	);
}
