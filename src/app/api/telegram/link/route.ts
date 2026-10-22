import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { completeTelegramLink, previewTelegramLink } from "@/lib/telegram-link/backend";
import { isLinkToken } from "@/lib/telegram-link/token";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
	try {
		await requireAuth();
		const token = request.nextUrl.searchParams.get("token");
		if (!isLinkToken(token)) return apiError("Invalid linking token", 400);

		const preview = await previewTelegramLink(token);

		return apiOk({ valid: preview.valid, telegramUserId: preview.telegram_user_id }, 200, {
			"Cache-Control": "no-store, private",
		});
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		assertSameOrigin(request);
		if (!request.headers.get("content-type")?.startsWith("application/json")) {
			return apiError("Content-Type must be application/json", 415);
		}

		const user = await requireAuth();
		let body: { token?: unknown };
		try {
			body = (await request.json()) as { token?: unknown };
		} catch {
			throw new ApiError(400, "Invalid JSON body");
		}
		if (!body || typeof body !== "object") return apiError("Invalid JSON body", 400);
		if (!isLinkToken(body.token)) return apiError("Invalid linking token", 400);

		await completeTelegramLink(body.token, user.id);

		return apiOk({ linked: true }, 200, { "Cache-Control": "no-store, private" });
	} catch (error) {
		return handleApiError(error);
	}
}

function assertSameOrigin(request: NextRequest) {
	const origin = request.headers.get("origin");
	const fetchSite = request.headers.get("sec-fetch-site");
	if (origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
		throw new ApiError(403, "Cross-origin request rejected");
	}
}
