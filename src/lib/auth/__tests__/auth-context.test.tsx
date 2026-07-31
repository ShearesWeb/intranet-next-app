import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

type AuthStateSnapshot = {
	user: { email: string } | null;
	session: Session | null;
	loading: boolean;
	signIn: (next?: string) => Promise<void>;
	signOut: () => Promise<void>;
};

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	push: vi.fn(),
	router: {
		push: vi.fn(),
	},
}));

mocks.router.push = mocks.push;

vi.mock("@/lib/supabase/client", () => ({
	createClient: mocks.createClient,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => mocks.router,
}));

describe("AuthContext", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		root.unmount();
		container.remove();
		vi.unstubAllGlobals();
	});

	async function flushEffects() {
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
	}

	function mockClient(session: Session | null) {
		const unsubscribe = vi.fn();
		const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
		const signOut = vi.fn().mockResolvedValue(undefined);

		mocks.createClient.mockReturnValue({
			auth: {
				getSession: vi.fn().mockResolvedValue({ data: { session } }),
				onAuthStateChange: vi.fn().mockReturnValue({
					data: { subscription: { unsubscribe } },
				}),
				signInWithOAuth,
				signOut,
			},
		});

		return { unsubscribe, signInWithOAuth, signOut };
	}

	it("redirects to /auth/login?reason=user_not_found when user email mismatch", async () => {
		const session = {
			user: { email: "a@test.com" },
		} as Session;
		mockClient(session);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ email: "b@test.com" }),
			}),
		);

		let latestAuth: AuthStateSnapshot | null = null;
		const { AuthProvider, useAuth } = await import("../auth-context");

		function Probe() {
			latestAuth = useAuth();
			return null;
		}

		await act(async () => {
			root.render(
				<AuthProvider>
					<Probe />
				</AuthProvider>,
			);
		});
		await flushEffects();

		expect(mocks.push).toHaveBeenCalledWith("/auth/login?reason=user_not_found");
		const authSnapshot = latestAuth as AuthStateSnapshot | null;
		expect(authSnapshot).not.toBeNull();
		expect(authSnapshot?.user).toBeNull();
	});

	it("redirects to /auth/login?reason=user_not_found when backend returns no user", async () => {
		const session = {
			user: { email: "a@test.com" },
		} as Session;
		mockClient(session);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				text: async () => "not found",
			}),
		);

		const { AuthProvider } = await import("../auth-context");

		await act(async () => {
			root.render(
				<AuthProvider>
					<div />
				</AuthProvider>,
			);
		});
		await flushEffects();

		expect(mocks.push).toHaveBeenCalledWith("/auth/login?reason=user_not_found");
	});

	it("destroys the stale session when backend returns no user (prevents middleware redirect loop)", async () => {
		const session = {
			user: { email: "a@test.com" },
		} as Session;
		const { signOut } = mockClient(session);

		const fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/api/auth/signout")) {
				return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
			}
			// /api/user — no profile row for this auth session
			return Promise.resolve({ ok: false, text: async () => "not found" });
		});
		vi.stubGlobal("fetch", fetchMock);

		const { AuthProvider } = await import("../auth-context");

		await act(async () => {
			root.render(
				<AuthProvider>
					<div />
				</AuthProvider>,
			);
		});
		await flushEffects();

		// Must clear the httpOnly Supabase cookies server-side, otherwise the
		// middleware keeps seeing an authenticated session on /auth/* and bounces
		// back to /dashboard → here → forever.
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/auth/signout",
			expect.objectContaining({ method: "POST" }),
		);
		expect(signOut).toHaveBeenCalled();
		expect(mocks.push).toHaveBeenCalledWith("/auth/login?reason=user_not_found");
	});

	it("sets user and session on successful auth", async () => {
		const session = {
			user: { email: "a@test.com" },
		} as Session;
		mockClient(session);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					data: {
						id: 1,
						email: "a@test.com",
						name: "Test User",
						room: "A101",
						points: 10,
						appointments: [],
						is_admin: false,
						is_jcrc: false,
						is_culture_sports_admin: false,
					},
					error: null,
				}),
			}),
		);

		let latestAuth: AuthStateSnapshot | null = null;
		const { AuthProvider, useAuth } = await import("../auth-context");

		function Probe() {
			latestAuth = useAuth();
			return null;
		}

		await act(async () => {
			root.render(
				<AuthProvider>
					<Probe />
				</AuthProvider>,
			);
		});
		await flushEffects();

		const authSnapshot = latestAuth as AuthStateSnapshot | null;
		expect(authSnapshot).not.toBeNull();
		expect(authSnapshot?.session).toBe(session);
		expect(authSnapshot?.user?.email).toBe("a@test.com");
	});
});
