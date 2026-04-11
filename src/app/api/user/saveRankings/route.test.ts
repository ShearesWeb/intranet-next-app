import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	fetchUserId: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/fetch-user-info", () => ({
	fetchUserId: mocks.fetchUserId,
}));

vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

const routePath = resolve(process.cwd(), "src/app/api/user/saveRankings/route.ts");

describe("saveRankings route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
	});

	it("calls replace_user_cca_rankings exactly once and returns success on a valid POST", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue({ rpc });
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rankings: [
						{ position_id: 4, ranking: 1 },
						{ position_id: 7, ranking: 2 },
					],
				}),
			}),
		);

		expect(rpc).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("replace_user_cca_rankings", {
			p_user_id: 55,
			p_rankings: [
				{ position_id: 4, ranking: 1, application_status: "pending" },
				{ position_id: 7, ranking: 2, application_status: "pending" },
			],
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
	});

	it("returns 500 when the replace_user_cca_rankings RPC fails", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: { message: "rpc failed" } });
		mocks.createClient.mockResolvedValue({ rpc });
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: "Failed to save rankings" });
	});

	it("returns 401 when fetchUserId cannot identify the caller", async () => {
		mocks.createClient.mockResolvedValue({ rpc: vi.fn() });
		mocks.fetchUserId.mockResolvedValue(null);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	it("removes the delete and insert write path from the route source", () => {
		const routeSource = readFileSync(routePath, "utf8");

		expect(routeSource).not.toContain(".delete()");
		expect(routeSource).not.toContain(".insert(preferences)");
	});
});
