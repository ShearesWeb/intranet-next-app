import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	fetchUserInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/fetch-user-info", () => ({
	fetchUserInfo: mocks.fetchUserInfo,
}));

describe("auth callback route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function mockSupabase(exchangeError: { message: string } | null = null) {
		const signOut = vi.fn().mockResolvedValue(undefined);
		const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: exchangeError });

		mocks.createClient.mockResolvedValue({
			auth: {
				exchangeCodeForSession,
				signOut,
			},
		});

		return { signOut, exchangeCodeForSession };
	}

	it("redirects to next path on successful login with valid user", async () => {
		mockSupabase();
		mocks.fetchUserInfo.mockResolvedValue({ id: 1, email: "a@test.com" });

		const { GET } = await import("../callback/route");
		const response = await GET(
			new Request("http://localhost/auth/callback?code=valid&next=/dashboard/my-cca"),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("http://localhost/dashboard/my-cca");
	});

	it("signs out and redirects to /auth/login?reason=user_not_found when user not in DB", async () => {
		const { signOut } = mockSupabase();
		mocks.fetchUserInfo.mockResolvedValue(null);

		const { GET } = await import("../callback/route");
		const response = await GET(
			new Request("http://localhost/auth/callback?code=valid&next=/dashboard"),
		);

		expect(signOut).toHaveBeenCalledTimes(1);
		expect(response.headers.get("location")).toContain("/auth/login?reason=user_not_found");
	});

	it("signs out and redirects to /auth/login?reason=user_not_found when fetchUserInfo throws", async () => {
		const { signOut } = mockSupabase();
		mocks.fetchUserInfo.mockRejectedValue(new Error("boom"));

		const { GET } = await import("../callback/route");
		const response = await GET(
			new Request("http://localhost/auth/callback?code=valid&next=/dashboard"),
		);

		expect(signOut).toHaveBeenCalledTimes(1);
		expect(response.headers.get("location")).toContain("/auth/login?reason=user_not_found");
	});

	it("redirects to /auth/login?reason=no_code when no code provided", async () => {
		mockSupabase();

		const { GET } = await import("../callback/route");
		const response = await GET(new Request("http://localhost/auth/callback"));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("/auth/login?reason=no_code");
	});

	it("redirects to /auth/login?reason=code_exchange_failed when code exchange fails", async () => {
		mockSupabase({ message: "exchange failed" });

		const { GET } = await import("../callback/route");
		const response = await GET(
			new Request("http://localhost/auth/callback?code=invalid&next=/dashboard"),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("/auth/login?reason=code_exchange_failed");
	});
});
