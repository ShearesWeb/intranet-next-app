"use client";

import { cn } from "@/lib/utils";

export interface FacilityTab<K extends string> {
	key: K;
	label: string;
	count?: number;
}

/** The underlined tab row shared by Book Facilities and Manage Facilities. */
export function FacilityTabs<K extends string>({
	tabs,
	active,
	onChange,
}: {
	tabs: FacilityTab<K>[];
	active: K;
	onChange: (key: K) => void;
}) {
	return (
		<div role="tablist" className="flex gap-6 border-b">
			{tabs.map((tab) => {
				const selected = tab.key === active;
				return (
					<button
						key={tab.key}
						type="button"
						role="tab"
						aria-selected={selected}
						onClick={() => onChange(tab.key)}
						className={cn(
							"relative flex cursor-pointer items-center gap-2 px-0.5 py-2.5 text-sm font-semibold",
							selected ? "text-foreground" : "text-muted-foreground",
						)}
					>
						<span>{tab.label}</span>
						{Boolean(tab.count) && (
							<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
								{tab.count}
							</span>
						)}
						<span
							className={cn(
								"absolute inset-x-0 -bottom-px h-0.5 bg-primary transition-transform duration-200",
								selected ? "scale-x-100" : "scale-x-0",
							)}
						/>
					</button>
				);
			})}
		</div>
	);
}

/** Dashed placeholder used inside facilities lists when there is nothing to show. */
export function FacilityEmpty({
	children,
	compact = false,
}: {
	children: React.ReactNode;
	compact?: boolean;
}) {
	return (
		<div
			className={cn(
				"border-2 border-dashed bg-muted text-center text-muted-foreground",
				compact ? "rounded-[10px] px-4 py-6 text-[13px]" : "rounded-[12px] px-6 py-12 text-sm",
			)}
		>
			📋 {children}
		</div>
	);
}

/** Green on/off switch for a venue's visibility on Book. */
export function VenueSwitch({
	checked,
	label,
	size = "md",
	disabled = false,
	onToggle,
}: {
	checked: boolean;
	label: string;
	size?: "sm" | "md";
	disabled?: boolean;
	onToggle: () => void;
}) {
	const small = size === "sm";
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={(event) => {
				event.stopPropagation();
				onToggle();
			}}
			className={cn(
				"relative flex-none cursor-pointer rounded-full disabled:cursor-wait disabled:opacity-60",
				small ? "h-5 w-9" : "h-[22px] w-10",
				checked ? "bg-green-600" : "bg-muted-foreground/40",
			)}
		>
			<span
				className={cn(
					"absolute top-0.5 rounded-full bg-white shadow-sm transition-[left] duration-150",
					small ? "size-4" : "size-[18px]",
				)}
				style={{ left: checked ? (small ? 18 : 20) : 2 }}
			/>
		</button>
	);
}

/** Heading above a day's requests or bookings: "Wed 4 Nov  [Tomorrow]". */
export function DayHeading({ label, relative }: { label: string; relative: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-[15px] font-bold">{label}</span>
			<span
				className={cn(
					"rounded-full px-2 py-0.5 text-[11px] font-bold",
					relative === "Today"
						? "bg-primary text-white"
						: relative === "Tomorrow"
							? "bg-accent text-fac-ink"
							: "bg-muted text-muted-foreground",
				)}
			>
				{relative}
			</span>
		</div>
	);
}

export const FACILITY_CARD_CLASS = "rounded-[12px] border bg-card shadow-sm";
export const CLAIM_STATUS_STYLE = {
	pending: { label: "Pending", className: "bg-fac-warn text-fac-warn-ink" },
	approved: { label: "Confirmed", className: "bg-fac-ok text-fac-ok-ink" },
	rejected: { label: "Declined", className: "bg-fac-danger-chip text-fac-danger-ink" },
} as const;
