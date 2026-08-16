import { describe, expect, it } from "vitest";
import {
	evaluateWindow,
	missingFlagRow,
	nextBoundaryMs,
	type TimedFlagRow,
} from "@/lib/timed-flags/window";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const HOUR = 3_600_000;

function row(overrides: Partial<TimedFlagRow>): TimedFlagRow {
	return { name: "test-flag", enabled: true, starts_at: null, expires_at: null, ...overrides };
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

describe("evaluateWindow", () => {
	it("is inactive when disabled, even inside the window", () => {
		const state = evaluateWindow(
			row({ enabled: false, starts_at: iso(NOW - HOUR), expires_at: iso(NOW + HOUR) }),
			NOW,
		);
		expect(state.active).toBe(false);
		expect(state.enabled).toBe(false);
	});

	it("is active when enabled with no bounds", () => {
		expect(evaluateWindow(row({}), NOW).active).toBe(true);
	});

	it("is inactive before starts_at and active from the boundary instant", () => {
		expect(evaluateWindow(row({ starts_at: iso(NOW + 1) }), NOW).active).toBe(false);
		expect(evaluateWindow(row({ starts_at: iso(NOW) }), NOW).active).toBe(true);
	});

	it("is active before expires_at and inactive from the boundary instant", () => {
		expect(evaluateWindow(row({ expires_at: iso(NOW + 1) }), NOW).active).toBe(true);
		expect(evaluateWindow(row({ expires_at: iso(NOW) }), NOW).active).toBe(false);
	});

	it("treats a malformed timestamp as inactive, never open", () => {
		expect(evaluateWindow(row({ starts_at: "not-a-date" }), NOW).active).toBe(false);
	});

	it("missingFlagRow evaluates disabled", () => {
		expect(evaluateWindow(missingFlagRow("absent"), NOW).active).toBe(false);
	});
});

describe("nextBoundaryMs", () => {
	it("returns the earliest future boundary across enabled rows", () => {
		const rows = [
			row({ name: "a", starts_at: iso(NOW + 2 * HOUR) }),
			row({ name: "b", expires_at: iso(NOW + HOUR) }),
		];
		expect(nextBoundaryMs(rows, NOW)).toBe(NOW + HOUR);
	});

	it("ignores past boundaries and disabled rows", () => {
		const rows = [
			row({ name: "a", starts_at: iso(NOW - HOUR) }),
			row({ name: "b", enabled: false, expires_at: iso(NOW + HOUR) }),
		];
		expect(nextBoundaryMs(rows, NOW)).toBeNull();
	});

	it("returns null when nothing is scheduled", () => {
		expect(nextBoundaryMs([row({})], NOW)).toBeNull();
	});
});
