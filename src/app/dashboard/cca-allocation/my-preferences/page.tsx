// src/app/dashboard/cca-allocation/my-preferences/page.tsx
// Read-only view of the caller's saved preference list. Entries from a closed
// period are shown locked; editing happens in the rank wizard while open.
"use client";

import React from "react";
import { Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";
import { DashedEmpty } from "@/components/shared/inline-states";
import { RankingPeriodBanner } from "@/components/allocation/ranking-period-banner";
import { useRankingPeriods } from "@/lib/timed-flags/ranking-periods-context";
import { periodKeyForPositionType } from "@/lib/timed-flags/ranking-periods";
import type { RankingPeriodState } from "@/lib/timed-flags/ranking-periods";
import type { SavedPreference } from "@/lib/allocation/preference-service";

interface PreferenceGroup {
	label: string;
	locked: boolean;
	preferences: SavedPreference[];
}

function groupByPeriod(
	preferences: SavedPreference[],
	periods: RankingPeriodState[],
): PreferenceGroup[] {
	const byPeriod = new Map<string, SavedPreference[]>();
	const other: SavedPreference[] = [];
	for (const preference of preferences) {
		const key = periodKeyForPositionType(preference.position_type);
		if (key === null) {
			other.push(preference);
			continue;
		}
		const bucket = byPeriod.get(key);
		if (bucket) bucket.push(preference);
		else byPeriod.set(key, [preference]);
	}

	const groups: PreferenceGroup[] = periods
		.filter((period) => (byPeriod.get(period.key) ?? []).length > 0)
		.map((period) => ({
			label: period.label,
			locked: !period.active,
			preferences: byPeriod.get(period.key) ?? [],
		}));
	if (other.length > 0) {
		groups.push({ label: "Other", locked: true, preferences: other });
	}
	return groups;
}

export default function MyPreferences() {
	const { periods, anyOpen, loading: periodsLoading } = useRankingPeriods();
	const [preferences, setPreferences] = React.useState<SavedPreference[] | null>(null);

	React.useEffect(() => {
		const fetchPreferences = async () => {
			try {
				const response = await fetch("/api/user/preferences");
				const json = await response.json();
				if (!response.ok) throw new Error(json.error || "Failed to load your saved preferences");
				setPreferences(json.data?.preferences ?? []);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Unknown error occurred");
				setPreferences([]);
			}
		};
		fetchPreferences();
	}, []);

	if (periodsLoading || periods === null || preferences === null) {
		return <DashboardTableSkeleton rows={6} cols={3} />;
	}

	const groups = groupByPeriod(preferences, periods);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="My saved preferences"
				description="Everything you have submitted so far. Entries from a closed period are locked."
				actions={
					anyOpen ? (
						<Button asChild size="sm" className="gap-2">
							<Link href="/dashboard/cca-allocation/rank">
								<Pencil className="h-4 w-4" />
								Edit preferences
							</Link>
						</Button>
					) : undefined
				}
			/>

			<RankingPeriodBanner periods={periods} />

			{groups.length === 0 ? (
				<DashedEmpty className="p-8">
					You have not saved any preferences yet.
					{anyOpen ? " A ranking period is open now, head to the rank page to submit." : ""}
				</DashedEmpty>
			) : (
				groups.map((group) => (
					<section key={group.label} className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
								{group.label}
							</h2>
							{group.locked && (
								<span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
									<Lock className="h-3 w-3" />
									Locked
								</span>
							)}
						</div>
						<ol className="flex flex-col gap-2">
							{group.preferences.map((preference) => (
								<li
									key={preference.position_id}
									className="flex items-center gap-3 rounded-lg border p-3"
								>
									<span className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums">
										{preference.rank}
									</span>
									<span className="flex min-w-0 flex-col">
										<span className="truncate font-medium leading-tight">{preference.name}</span>
										<span className="truncate text-sm text-muted-foreground">
											{preference.cca_name}
										</span>
									</span>
								</li>
							))}
						</ol>
					</section>
				))
			)}
		</div>
	);
}
