"use client";

import { CalendarClock, Lock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RankingPeriodState } from "@/lib/timed-flags/ranking-periods";

function formatInstant(iso: string | null): string | null {
	if (!iso) return null;
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return null;
	return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function periodStatus(period: RankingPeriodState): { text: string; icon: typeof Timer } {
	if (period.active) {
		const until = formatInstant(period.expiresAt);
		return { text: until ? `Open until ${until}` : "Open", icon: Timer };
	}
	if (period.upcoming) {
		const opens = formatInstant(period.startsAt);
		return { text: opens ? `Opens ${opens}` : "Opening soon", icon: CalendarClock };
	}
	return { text: "Closed", icon: Lock };
}

export function RankingPeriodBanner({ periods }: { periods: RankingPeriodState[] }) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:gap-6">
			{periods.map((period) => {
				const status = periodStatus(period);
				const Icon = status.icon;
				return (
					<div key={period.key} className="flex items-center gap-2">
						<Icon
							className={cn(
								"h-4 w-4 flex-shrink-0",
								period.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
							)}
						/>
						<span className="font-medium">{period.label}:</span>
						<span
							className={cn(
								period.active
									? "font-medium text-emerald-700 dark:text-emerald-400"
									: "text-muted-foreground",
							)}
						>
							{status.text}
						</span>
					</div>
				);
			})}
		</div>
	);
}
