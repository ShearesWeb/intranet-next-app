import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { previewTelegramLink } from "@/lib/telegram-link/backend";
import { isLinkToken } from "@/lib/telegram-link/token";
import { LinkTelegramForm } from "./link-form";

type Props = {
	searchParams: Promise<{ token?: string | string[] }>;
};

export default async function LinkTelegramPage({ searchParams }: Props) {
	const user = await requireAuth();
	const rawToken = (await searchParams).token;
	const token = Array.isArray(rawToken) ? undefined : rawToken;

	let telegramUserId: string | null = null;
	let tokenError: string | null = null;
	if (!isLinkToken(token)) {
		tokenError =
			"This linking URL is missing or malformed. Return to Telegram and send /link again.";
	} else {
		try {
			const preview = await previewTelegramLink(token);
			telegramUserId = preview.telegram_user_id;
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				tokenError =
					"This linking URL has expired or was already used. Return to Telegram and send /link again.";
			} else {
				throw error;
			}
		}
	}

	return (
		<main className="mx-auto max-w-lg p-8">
			<div className="rounded-xl border p-6 shadow-sm">
				<h1 className="mb-3 text-2xl font-bold">Link Telegram Account</h1>

				<p className="mb-6 text-gray-600">
					Review both accounts before creating a permanent one-to-one connection.
				</p>

				<div className="mb-4 rounded-lg bg-gray-100 p-4 text-black">
					<p className="font-semibold">Sheares Intranet account</p>
					<p>Name: {user.name}</p>
					<p>Room: {user.room}</p>
					<p>Email: {user.email}</p>
				</div>

				{telegramUserId && (
					<div className="rounded-lg bg-gray-100 p-4 text-black">
						<p className="font-semibold">Telegram account</p>
						<p>Verified private-chat account ending in {telegramUserId.slice(-4)}</p>
					</div>
				)}

				{tokenError ? (
					<p role="alert" className="mt-6 text-sm text-red-600">
						{tokenError}
					</p>
				) : (
					token && <LinkTelegramForm token={token} />
				)}
			</div>
		</main>
	);
}
