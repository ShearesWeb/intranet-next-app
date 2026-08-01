/** Hard cap on how many positions one applicant may rank as preferences. */
export const MAX_PREFERENCES = 6;

export type PreferenceTier = "empty" | "critical" | "low" | "good" | "full";

export interface PreferenceUsage {
	/** Selected count, clamped to zero. */
	count: number;
	max: number;
	/** Slots still available, zero once the cap is reached. */
	remaining: number;
	/** Share of the cap used, 0–100. */
	percent: number;
	tier: PreferenceTier;
	atCap: boolean;
}

function tierFor(count: number): PreferenceTier {
	if (count <= 0) return "empty";
	if (count <= 2) return "critical";
	if (count <= 4) return "low";
	if (count < MAX_PREFERENCES) return "good";
	return "full";
}

/**
 * Progress of an applicant's preference list toward the {@link MAX_PREFERENCES} cap.
 * Counts above the cap clamp to it, so an over-filled list still reads as full.
 */
export function getPreferenceUsage(selectedCount: number): PreferenceUsage {
	const count = Math.max(0, Math.trunc(selectedCount));
	const capped = Math.min(count, MAX_PREFERENCES);
	return {
		count,
		max: MAX_PREFERENCES,
		remaining: MAX_PREFERENCES - capped,
		percent: Math.round((capped / MAX_PREFERENCES) * 100),
		tier: tierFor(count),
		atCap: count >= MAX_PREFERENCES,
	};
}

/** Whether one more position may still be added to the list. */
export function canAddPreference(selectedCount: number): boolean {
	return selectedCount < MAX_PREFERENCES;
}
