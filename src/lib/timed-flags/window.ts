// Pure window math for DB-backed timed feature flags (`feature_flags` table).
// Shared by server routes and client hooks; keep this file free of imports
// with server- or client-only dependencies.

/** Row shape of `feature_flags` as served by PostgREST. */
export interface TimedFlagRow {
	name: string;
	enabled: boolean;
	starts_at: string | null;
	expires_at: string | null;
}

export interface TimedFlagState {
	name: string;
	enabled: boolean;
	active: boolean;
	startsAt: string | null;
	expiresAt: string | null;
}

/**
 * The schema contract leaves window enforcement to the app: the table stores
 * `starts_at`/`expires_at` but never filters rows by them. A malformed
 * timestamp parses to NaN, fails both comparisons, and lands on inactive.
 */
export function evaluateWindow(row: TimedFlagRow, nowMs: number): TimedFlagState {
	const startMs = row.starts_at === null ? null : Date.parse(row.starts_at);
	const endMs = row.expires_at === null ? null : Date.parse(row.expires_at);
	const active =
		row.enabled && (startMs === null || startMs <= nowMs) && (endMs === null || nowMs < endMs);

	return {
		name: row.name,
		enabled: row.enabled,
		active,
		startsAt: row.starts_at,
		expiresAt: row.expires_at,
	};
}

/** Absent rows behave as a disabled flag, so a missing seed can only fail closed. */
export function missingFlagRow(name: string): TimedFlagRow {
	return { name, enabled: false, starts_at: null, expires_at: null };
}

/**
 * Earliest future start/expiry across enabled rows, or null when no flip is
 * scheduled. Disabled rows can't change state by time alone, so they are
 * skipped.
 */
export function nextBoundaryMs(rows: TimedFlagRow[], nowMs: number): number | null {
	let next: number | null = null;
	for (const row of rows) {
		if (!row.enabled) continue;
		for (const iso of [row.starts_at, row.expires_at]) {
			if (iso === null) continue;
			const t = Date.parse(iso);
			if (Number.isFinite(t) && t > nowMs && (next === null || t < next)) next = t;
		}
	}
	return next;
}
