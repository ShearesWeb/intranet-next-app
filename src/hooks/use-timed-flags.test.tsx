import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimedFlags, type UseTimedFlagsResult } from "@/hooks/use-timed-flags";
import type { TimedFlagRow } from "@/lib/timed-flags/window";

const NOW = Date.parse("2026-08-16T11:59:00Z");

function flagsResponse(rows: TimedFlagRow[], serverNowMs: number) {
	return {
		ok: true,
		json: async () => ({ data: { flags: rows, serverNow: new Date(serverNowMs).toISOString() } }),
	} as Response;
}

describe("useTimedFlags", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers({ now: NOW });
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	const renderHook = (names: string[]) => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root: Root = createRoot(container);
		const result: { current: UseTimedFlagsResult | null } = { current: null };

		function Harness() {
			result.current = useTimedFlags(names);
			return null;
		}

		act(() => {
			root.render(<Harness />);
		});

		return {
			result,
			unmount: () => {
				act(() => {
					root.unmount();
				});
				container.remove();
			},
		};
	};

	it("flips a flag inactive when the clock crosses expires_at", async () => {
		// Expires one minute after mount.
		const row: TimedFlagRow = {
			name: "subcomm-ranking-period",
			enabled: true,
			starts_at: null,
			expires_at: new Date(NOW + 60_000).toISOString(),
		};
		// The mock plays the server: serverNow tracks the (fake) clock at each call.
		fetchMock.mockImplementation(async () => flagsResponse([row], Date.now()));

		const { result, unmount } = renderHook(["subcomm-ranking-period"]);
		await act(async () => {});

		expect(result.current?.loading).toBe(false);
		expect(result.current?.states?.["subcomm-ranking-period"].active).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// The boundary timer fires just past expiry: state flips and a refetch runs.
		await act(async () => {
			vi.advanceTimersByTime(61_000);
		});

		expect(result.current?.states?.["subcomm-ranking-period"].active).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		unmount();
	});

	it("corrects for client clock skew using serverNow", async () => {
		// Server says the flag expired already; the client clock is 2 minutes behind.
		const row: TimedFlagRow = {
			name: "subcomm-ranking-period",
			enabled: true,
			starts_at: null,
			expires_at: new Date(NOW + 60_000).toISOString(),
		};
		fetchMock.mockResolvedValue(flagsResponse([row], NOW + 120_000));

		const { result, unmount } = renderHook(["subcomm-ranking-period"]);
		await act(async () => {});

		expect(result.current?.states?.["subcomm-ranking-period"].active).toBe(false);

		unmount();
	});

	it("treats a flag the server omitted as absent from states", async () => {
		fetchMock.mockResolvedValue(flagsResponse([], NOW));

		const { result, unmount } = renderHook(["missing-flag"]);
		await act(async () => {});

		expect(result.current?.loading).toBe(false);
		expect(result.current?.states).toEqual({});

		unmount();
	});
});
