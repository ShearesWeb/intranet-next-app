import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AwsClient } from "aws4fetch";
import { ApiError } from "@/lib/api/errors";

type PreviewResult = {
	valid: true;
	telegram_user_id: string;
};

type CompleteResult = {
	linked: true;
};

function runtimeValue(name: string, fallback?: string): string {
	const nodeValue = process.env[name];
	if (nodeValue) return nodeValue;

	try {
		const env = getCloudflareContext().env as unknown as Record<string, string | undefined>;
		const workerValue = env[name];
		if (workerValue) return workerValue;
	} catch {
		// Unit tests and plain Node tooling do not have a Workers request context.
	}

	if (fallback) return fallback;
	throw new Error(`Missing server-side Telegram linking setting: ${name}`);
}

async function callBackend<T>(path: "preview" | "complete", body: object): Promise<T> {
	const endpoint = runtimeValue("TELEGRAM_LINK_API_URL").replace(/\/$/, "");
	const client = new AwsClient({
		accessKeyId: runtimeValue("TELEGRAM_LINK_AWS_ACCESS_KEY_ID"),
		secretAccessKey: runtimeValue("TELEGRAM_LINK_AWS_SECRET_ACCESS_KEY"),
		region: runtimeValue("TELEGRAM_LINK_AWS_REGION", "ap-southeast-1"),
		service: "execute-api",
		retries: 0,
	});

	const response = await client.fetch(`${endpoint}/internal/telegram-link/${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	let payload: { error?: unknown } = {};
	try {
		payload = (await response.json()) as { error?: unknown };
	} catch {
		// API Gateway errors are not guaranteed to use the Lambda JSON shape.
	}

	if (!response.ok) {
		if ([400, 404, 409].includes(response.status) && typeof payload.error === "string") {
			throw new ApiError(response.status, payload.error);
		}
		throw new Error(`Telegram linking backend returned HTTP ${response.status}`);
	}

	return payload as T;
}

export function previewTelegramLink(token: string) {
	return callBackend<PreviewResult>("preview", { token });
}

export function completeTelegramLink(token: string, residentId: number) {
	return callBackend<CompleteResult>("complete", { token, resident_id: residentId });
}
