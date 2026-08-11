import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
	createServerClient: mocks.createServerClient,
}));

describe("updateSession", () => {
	const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mlklfakrvuvkftgowzts.supabase.co";
	});

	afterEach(() => {
		if (ORIGINAL_SUPABASE_URL === undefined) {
			delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		} else {
			process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
		}
	});

	function setupUpdateSession(options?: {
		claims?: Record<string, unknown> | null;
		error?: { message: string } | null;
		cookiesToSet?: Array<{
			name: string;
			value: string;
			options?: Record<string, unknown>;
		}>;
		headers?: Record<string, string>;
	}) {
		const auth = {
			getClaims: vi.fn().mockImplementation(async () => {
				if (options?.cookiesToSet) {
					const [[, , config]] = mocks.createServerClient.mock.calls;
					config.cookies.setAll(options.cookiesToSet, options.headers ?? {});
				}

				return {
					data: { claims: options?.claims ?? { sub: "user-123" } },
					error: options?.error ?? null,
				};
			}),
		};

		mocks.createServerClient.mockReturnValue({ auth });

		return auth;
	}

	it("writes refreshed cookies to both request and response when setAll is called", async () => {
		setupUpdateSession({
			cookiesToSet: [
				{
					name: "sb-access-token",
					value: "fresh-token",
					options: { path: "/", httpOnly: true },
				},
			],
			headers: {
				"Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
			},
		});

		const { updateSession } = await import("../middleware");
		const request = new NextRequest("http://localhost/dashboard/my-cca");

		const response = await updateSession(request);

		expect(request.cookies.get("sb-access-token")?.value).toBe("fresh-token");
		expect(response.cookies.get("sb-access-token")?.value).toBe("fresh-token");
		expect(response.headers.get("Cache-Control")).toBe(
			"private, no-cache, no-store, must-revalidate, max-age=0",
		);
	});

	it("applies cache-control headers from setAll second argument to response", async () => {
		setupUpdateSession({
			cookiesToSet: [
				{
					name: "sb-refresh-token",
					value: "refresh-token",
					options: { path: "/", httpOnly: true },
				},
			],
			headers: {
				"Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
				Expires: "0",
				Pragma: "no-cache",
			},
		});

		const { updateSession } = await import("../middleware");
		const response = await updateSession(new NextRequest("http://localhost/dashboard/settings"));

		expect(response.headers.get("Cache-Control")).toBe(
			"private, no-cache, no-store, must-revalidate, max-age=0",
		);
		expect(response.headers.get("Expires")).toBe("0");
		expect(response.headers.get("Pragma")).toBe("no-cache");
	});

	it("redirects to /auth/login with reason=session_expired and next param when session is missing on /dashboard path", async () => {
		setupUpdateSession({
			claims: null,
			error: { message: "Auth session missing" },
		});

		const { updateSession } = await import("../middleware");
		const response = await updateSession(new NextRequest("http://localhost/dashboard/my-cca"));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("/auth/login");
		expect(response.headers.get("location")).toContain("reason=session_expired");
		expect(response.headers.get("location")).toContain("next=%2Fdashboard%2Fmy-cca");
	});

	it("redirects unauthenticated user from /dashboard to /auth/login with reason and next", async () => {
		setupUpdateSession({
			claims: {},
			error: null,
		});

		const { updateSession } = await import("../middleware");
		const response = await updateSession(new NextRequest("http://localhost/dashboard/settings"));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(
			"http://localhost/auth/login?reason=session_expired&next=%2Fdashboard%2Fsettings",
		);
	});

	it("allows auth page requests to proceed when session is missing", async () => {
		setupUpdateSession({
			claims: null,
			error: { message: "Auth session missing" },
		});

		const { updateSession } = await import("../middleware");
		const response = await updateSession(new NextRequest("http://localhost/auth/login"));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
	});

	it("redirects authenticated user away from /auth to /dashboard", async () => {
		setupUpdateSession({
			claims: { sub: "user-123" },
			error: null,
		});

		const { updateSession } = await import("../middleware");
		const response = await updateSession(new NextRequest("http://localhost/auth/login"));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("http://localhost/dashboard");
	});

	describe("foreign-projref cookie eviction", () => {
		it("expires sb-<otherref>-* cookies from the browser on every request", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.1", "stale");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", "valid");
			request.cookies.set("sidebar:state", "true");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			const evicted0 = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0");
			const evicted1 = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.1");
			expect(evicted0?.value).toBe("");
			expect(evicted0?.maxAge).toBe(0);
			expect(evicted1?.value).toBe("");
			expect(evicted1?.maxAge).toBe(0);
		});

		it("does not evict the current projref's cookies", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", "valid");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token-code-verifier", "verifier");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.0")).toBeUndefined();
			expect(
				response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token-code-verifier"),
			).toBeUndefined();
		});

		it("keeps eviction Set-Cookies when Supabase refreshes the session mid-request", async () => {
			setupUpdateSession({
				cookiesToSet: [
					{
						name: "sb-mlklfakrvuvkftgowzts-auth-token.0",
						value: "fresh",
						options: { path: "/" },
					},
				],
			});

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			const evicted = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0");
			expect(evicted?.value).toBe("");
			expect(evicted?.maxAge).toBe(0);
		});

		it("keeps eviction Set-Cookies on the /dashboard -> /auth/login redirect", async () => {
			setupUpdateSession({ claims: null, error: { message: "Auth session missing" } });

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.status).toBe(307);
			const evicted = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0");
			expect(evicted?.value).toBe("");
			expect(evicted?.maxAge).toBe(0);
		});

		it("keeps eviction Set-Cookies on the /auth -> /dashboard redirect", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/auth/login");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.status).toBe(307);
			const evicted = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0");
			expect(evicted?.value).toBe("");
			expect(evicted?.maxAge).toBe(0);
		});

		it("removes foreign cookies from the request before Supabase reads them", async () => {
			const auth = setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", "valid");

			const { updateSession } = await import("../middleware");
			await updateSession(request);

			expect(auth.getClaims).toHaveBeenCalled();
			expect(request.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0")).toBeUndefined();
			expect(request.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.0")?.value).toBe("valid");
		});
	});

	describe("cookie-size circuit breaker", () => {
		const big = (size: number) => "x".repeat(size);

		it("redirects to /auth/login?reason=cookie_overflow and clears sb-* when over the threshold", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", big(8000));
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.1", big(8000));

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth/login");
			expect(response.headers.get("location")).toContain("reason=cookie_overflow");
			const cleared0 = response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.0");
			const cleared1 = response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.1");
			expect(cleared0?.value).toBe("");
			expect(cleared0?.maxAge).toBe(0);
			expect(cleared1?.value).toBe("");
			expect(cleared1?.maxAge).toBe(0);
		});

		it("does not redirect when already on /auth/* (avoid loop)", async () => {
			setupUpdateSession({ claims: null, error: { message: "Auth session missing" } });

			const request = new NextRequest("http://localhost/auth/login");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", big(8000));
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.1", big(8000));

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.headers.get("location")).toBeNull();
			const cleared = response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.0");
			expect(cleared?.value).toBe("");
			expect(cleared?.maxAge).toBe(0);
		});

		it("trips below 10 KB, the size at which the AWS origin 413s", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", big(9000));

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.headers.get("location")).toContain("reason=cookie_overflow");
		});

		it("does not trip when cookies are under the threshold", async () => {
			setupUpdateSession();

			const request = new NextRequest("http://localhost/dashboard/my-cca");
			request.cookies.set("sb-mlklfakrvuvkftgowzts-auth-token.0", big(1000));

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			expect(response.headers.get("location")).toBeNull();
			expect(response.cookies.get("sb-mlklfakrvuvkftgowzts-auth-token.0")).toBeUndefined();
		});
	});

	describe("landing page /", () => {
		it("does not redirect unauthenticated users away from /", async () => {
			setupUpdateSession({ claims: null, error: { message: "Auth session missing" } });

			const { updateSession } = await import("../middleware");
			const response = await updateSession(new NextRequest("http://localhost/"));

			expect(response.headers.get("location")).toBeNull();
		});

		it("still evicts foreign-projref cookies on /", async () => {
			setupUpdateSession({ claims: null, error: { message: "Auth session missing" } });

			const request = new NextRequest("http://localhost/");
			request.cookies.set("sb-fekyehxztmfdnuknfmeq-auth-token.0", "stale");

			const { updateSession } = await import("../middleware");
			const response = await updateSession(request);

			const evicted = response.cookies.get("sb-fekyehxztmfdnuknfmeq-auth-token.0");
			expect(evicted?.value).toBe("");
			expect(evicted?.maxAge).toBe(0);
		});
	});
});
