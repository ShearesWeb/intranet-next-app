import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
	AwsClient: vi.fn(),
}));

vi.mock("aws4fetch", () => ({ AwsClient: mocks.AwsClient }));
vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: () => {
		throw new Error("No Workers context in this unit test");
	},
}));

const environment = {
	TELEGRAM_LINK_API_URL: "https://abc.execute-api.ap-southeast-1.amazonaws.com",
	TELEGRAM_LINK_AWS_ACCESS_KEY_ID: "test-access-key",
	TELEGRAM_LINK_AWS_SECRET_ACCESS_KEY: "test-secret-key",
};

describe("Telegram linking backend client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.assign(process.env, environment);
		mocks.AwsClient.mockImplementation(function MockAwsClient() {
			return { fetch: mocks.fetch };
		});
	});

	afterEach(() => {
		for (const key of Object.keys(environment)) delete process.env[key];
	});

	it("SigV4-signs completion and sends the authenticated resident ID", async () => {
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ linked: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const { completeTelegramLink } = await import("./backend");

		await completeTelegramLink("a".repeat(43), 42);

		expect(mocks.AwsClient).toHaveBeenCalledWith({
			accessKeyId: "test-access-key",
			secretAccessKey: "test-secret-key",
			region: "ap-southeast-1",
			service: "execute-api",
			retries: 0,
		});
		expect(mocks.fetch).toHaveBeenCalledWith(
			"https://abc.execute-api.ap-southeast-1.amazonaws.com/internal/telegram-link/complete",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ token: "a".repeat(43), resident_id: 42 }),
			}),
		);
	});

	it("preserves safe token errors from the backend", async () => {
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid or expired token" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const { previewTelegramLink } = await import("./backend");

		await expect(previewTelegramLink("a".repeat(43))).rejects.toEqual(
			expect.objectContaining({
				statusCode: 404,
				message: "Invalid or expired token",
			}),
		);
	});

	it("does not expose API Gateway authentication details", async () => {
		mocks.fetch.mockResolvedValue(new Response("Forbidden credential detail", { status: 403 }));
		const { previewTelegramLink } = await import("./backend");

		await expect(previewTelegramLink("a".repeat(43))).rejects.toThrow(
			"Telegram linking backend returned HTTP 403",
		);
	});
});
