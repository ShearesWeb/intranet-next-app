import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const request = new NextRequest("http://localhost/dashboard/mycca");

    const response = await updateSession(request);

    expect(request.cookies.get("sb-access-token")?.value).toBe("fresh-token");
    expect(response.cookies.get("sb-access-token")?.value).toBe("fresh-token");
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0"
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
    const response = await updateSession(
      new NextRequest("http://localhost/dashboard/settings")
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0"
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
    const response = await updateSession(
      new NextRequest("http://localhost/dashboard/mycca")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
    expect(response.headers.get("location")).toContain("reason=session_expired");
    expect(response.headers.get("location")).toContain(
      "next=%2Fdashboard%2Fmycca"
    );
  });

  it("redirects unauthenticated user from /dashboard to /auth/login with reason and next", async () => {
    setupUpdateSession({
      claims: {},
      error: null,
    });

    const { updateSession } = await import("../middleware");
    const response = await updateSession(
      new NextRequest("http://localhost/dashboard/settings")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/login?reason=session_expired&next=%2Fdashboard%2Fsettings"
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
});
