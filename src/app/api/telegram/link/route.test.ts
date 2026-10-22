import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	previewTelegramLink: vi.fn(),
	completeTelegramLink: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/telegram-link/backend", () => ({
	previewTelegramLink: mocks.previewTelegramLink,
	completeTelegramLink: mocks.completeTelegramLink,
}));

const token = "a".repeat(43);

function post(body: unknown, headers: Record<string, string> = {}) {
	return new NextRequest("http://localhost/api/telegram/link", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "http://localhost",
			"Sec-Fetch-Site": "same-origin",
			...headers,
		},
		body: JSON.stringify(body),
	});
}

describe("Telegram linking API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.previewTelegramLink.mockResolvedValue({ valid: true, telegram_user_id: "12345" });
		mocks.completeTelegramLink.mockResolvedValue({ linked: true });
	});

	it("previews a token without taking resident identity from the query", async () => {
		const { GET } = await import("./route");
		const response = await GET(
			new NextRequest(`http://localhost/api/telegram/link?token=${token}&residentId=999`),
		);

		expect(response.status).toBe(200);
		expect(mocks.previewTelegramLink).toHaveBeenCalledWith(token);
		expect(mocks.requireAuth).toHaveBeenCalledOnce();
	});

	it("derives the resident ID from requireAuth during completion", async () => {
		const { POST } = await import("./route");
		const response = await POST(post({ token, residentId: 999 }));

		expect(response.status).toBe(200);
		expect(mocks.completeTelegramLink).toHaveBeenCalledWith(token, 42);
	});

	it.each([
		["missing origin", {}],
		["foreign origin", { Origin: "https://attacker.example" }],
		["cross-site fetch", { "Sec-Fetch-Site": "cross-site" }],
	])("rejects CSRF: %s", async (name, override) => {
		const { POST } = await import("./route");
		const request = post({ token }, override);
		if (name === "missing origin") request.headers.delete("origin");

		const response = await POST(request);

		expect(response.status).toBe(403);
		expect(mocks.requireAuth).not.toHaveBeenCalled();
		expect(mocks.completeTelegramLink).not.toHaveBeenCalled();
	});

	it("rejects malformed tokens before calling the backend", async () => {
		const { POST } = await import("./route");
		const response = await POST(post({ token: "short" }));

		expect(response.status).toBe(400);
		expect(mocks.completeTelegramLink).not.toHaveBeenCalled();
	});

	it("returns 400 for invalid JSON", async () => {
		const { POST } = await import("./route");
		const request = new NextRequest("http://localhost/api/telegram/link", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://localhost",
				"Sec-Fetch-Site": "same-origin",
			},
			body: "{",
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
		expect(mocks.completeTelegramLink).not.toHaveBeenCalled();
	});
});
