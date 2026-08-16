"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	evaluateWindow,
	nextBoundaryMs,
	type TimedFlagRow,
	type TimedFlagState,
} from "@/lib/timed-flags/window";

// Fire just past the boundary so timer precision can't land us a tick early.
const BOUNDARY_LAG_MS = 250;
// setTimeout treats delays above 2^31-1 as 0; clamp and let the refetch reschedule.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface FlagsPayload {
	rows: TimedFlagRow[];
	/** serverNow - clientNow at fetch time; evaluate at Date.now() + skewMs. */
	skewMs: number;
}

export interface UseTimedFlagsResult {
	/** Null until the first fetch lands. */
	states: Record<string, TimedFlagState> | null;
	loading: boolean;
	error: string | null;
	refresh: () => void;
}

/**
 * Live view of timed feature flags. State flips at window boundaries without
 * polling: one timeout is armed for the earliest future start/expiry, and a
 * refetch runs on focus/visibility since background tabs throttle timers.
 */
export function useTimedFlags(names: readonly string[]): UseTimedFlagsResult {
	const namesKey = names.join(",");
	const [payload, setPayload] = useState<FlagsPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Bumped when a boundary passes so `states` re-derives before the refetch lands.
	const [tick, setTick] = useState(0);

	const fetchFlags = useCallback(async () => {
		try {
			const res = await fetch(`/api/feature-flags?names=${encodeURIComponent(namesKey)}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load feature flags");
			const rows: TimedFlagRow[] = json.data.flags;
			const skewMs = Date.parse(json.data.serverNow) - Date.now();
			setPayload({ rows, skewMs: Number.isFinite(skewMs) ? skewMs : 0 });
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load feature flags");
		}
	}, [namesKey]);

	useEffect(() => {
		fetchFlags();
		const onVisible = () => {
			if (document.visibilityState === "visible") fetchFlags();
		};
		window.addEventListener("focus", onVisible);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener("focus", onVisible);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [fetchFlags]);

	useEffect(() => {
		if (payload === null) return;
		const nowMs = Date.now() + payload.skewMs;
		const boundary = nextBoundaryMs(payload.rows, nowMs);
		if (boundary === null) return;
		const delay = Math.min(Math.max(boundary - nowMs, 0) + BOUNDARY_LAG_MS, MAX_TIMEOUT_MS);
		const timer = setTimeout(() => {
			setTick((t) => t + 1);
			// Refetch too: the row may have changed (e.g. a deadline extension).
			fetchFlags();
		}, delay);
		return () => clearTimeout(timer);
	}, [payload, fetchFlags]);

	const states = useMemo(() => {
		if (payload === null) return null;
		void tick;
		const nowMs = Date.now() + payload.skewMs;
		const result: Record<string, TimedFlagState> = {};
		for (const row of payload.rows) {
			result[row.name] = evaluateWindow(row, nowMs);
		}
		return result;
	}, [payload, tick]);

	return {
		states,
		loading: payload === null && error === null,
		error,
		refresh: fetchFlags,
	};
}
