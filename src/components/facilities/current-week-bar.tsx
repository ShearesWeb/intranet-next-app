"use client";

import { cn } from "@/lib/utils";

interface CurrentWeekBarProps {
	weekNumber: number;
	dates: string[];
	selectedDate: string;
	onSelectDate: (date: string) => void;
}

function formatDate(dateKey: string): string {
	return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", {
		timeZone: "UTC",
		day: "numeric",
		month: "short",
	});
}

function formatDay(dateKey: string): string {
	return new Date(`${dateKey}T00:00:00Z`)
		.toLocaleDateString("en-GB", {
			timeZone: "UTC",
			weekday: "short",
		})
		.toUpperCase();
}

export function CurrentWeekBar({
	weekNumber,
	dates,
	selectedDate,
	onSelectDate,
}: CurrentWeekBarProps) {
	return (
		<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
			<div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] sm:grid-cols-[8rem_repeat(7,minmax(0,1fr))]">
				<div className="flex items-center bg-orange-50 px-3 sm:px-5">
					<h2 className="whitespace-nowrap text-sm font-semibold sm:text-lg">Week {weekNumber}</h2>
				</div>

				{dates.map((date) => {
					const selected = date === selectedDate;

					return (
						<button
							key={date}
							type="button"
							aria-current={selected ? "date" : undefined}
							onClick={() => onSelectDate(date)}
							className={cn(
								"relative min-w-0 border-l px-1 py-3 text-center transition-colors sm:py-4",
								"hover:bg-orange-50/60",
								selected ? "bg-orange-50 text-orange-600" : "bg-background text-muted-foreground",
							)}
						>
							<span className="block whitespace-nowrap text-[10px] font-semibold tabular-nums sm:text-sm">
								{formatDate(date)}
							</span>
							<span className="mt-1 block text-[9px] font-semibold sm:text-xs">
								{formatDay(date)}
							</span>

							{selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-orange-500" />}
						</button>
					);
				})}
			</div>
		</div>
	);
}
