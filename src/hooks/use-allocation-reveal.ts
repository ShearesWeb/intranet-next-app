"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import {
	buildAllocationReveal,
	revealSeenStorageKey,
	type AllocationReveal,
} from "@/lib/cca/allocation-reveal";
import { getAllocationRevealPeriod, isCoreServiceEnabled } from "@/lib/feature-flags";
import type { CCAData } from "@/types/cca-data";

interface UseAllocationRevealReturn {
	/** The reveal for the live round, or null while the flag is off or data is loading. */
	reveal: AllocationReveal | null;
	open: boolean;
	/** Open it again on demand — the reveal stays re-watchable after the first time. */
	replay: () => void;
	/** Close and remember, so the auto-open only ever fires once per round. */
	dismiss: () => void;
}

function hasSeen(key: string): boolean {
	try {
		return window.localStorage.getItem(key) === "1";
	} catch {
		// Private-mode or blocked storage: fall back to showing the reveal rather
		// than swallowing it. Worst case a resident sees it twice.
		return false;
	}
}

function markSeen(key: string) {
	try {
		window.localStorage.setItem(key, "1");
	} catch {
		// Nothing to do — the reveal simply auto-opens again next visit.
	}
}

/**
 * Drives the allocation reveal overlay on My CCAs.
 *
 * Auto-opens once per resident per round; after that it is available on demand
 * via `replay`. "Seen" lives in `localStorage` keyed by user id, matching how
 * `useRoleAuth` caches per-user state client-side.
 */
export function useAllocationReveal(ccas: CCAData[], loaded: boolean): UseAllocationRevealReturn {
	const { user, loading: authLoading } = useAuth();
	const period = getAllocationRevealPeriod();
	const enabled = isCoreServiceEnabled("allocationReveal");
	const userId = user?.id ?? null;

	const [open, setOpen] = useState(false);

	/**
	 * `useCcaList` is disabled until the user resolves, and a disabled query
	 * reports `loading: false` with no rows. Reading that as "no allocations"
	 * would flash the consolation card at someone who actually got a position,
	 * so a resident holding appointments is only settled once rows arrive.
	 */
	const appointmentCount = user?.appointments?.length ?? 0;
	const settled = !authLoading && loaded && (appointmentCount === 0 || ccas.length > 0);

	useEffect(() => {
		if (!enabled || !settled || userId === null) return;
		if (hasSeen(revealSeenStorageKey(userId, period))) return;
		setOpen(true);
	}, [enabled, settled, userId, period]);

	const dismiss = useCallback(() => {
		setOpen(false);
		if (userId !== null) {
			markSeen(revealSeenStorageKey(userId, period));
		}
	}, [userId, period]);

	const replay = useCallback(() => setOpen(true), []);

	return {
		reveal: enabled && settled ? buildAllocationReveal(ccas, period) : null,
		open,
		replay,
		dismiss,
	};
}
