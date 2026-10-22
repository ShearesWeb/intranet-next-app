"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LinkTelegramForm({ token }: { token: string }) {
	const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
	const [error, setError] = useState("");

	async function completeLink() {
		setState("submitting");
		setError("");

		try {
			const response = await fetch("/api/telegram/link", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(payload.error || "Unable to link accounts");

			window.history.replaceState(null, "", "/dashboard/link-telegram");
			setState("success");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Unable to link accounts");
			setState("error");
		}
	}

	if (state === "success") {
		return (
			<div role="status" className="mt-6 rounded-lg bg-green-50 p-4 text-green-800">
				Your Telegram and Sheares Intranet accounts are now linked.
			</div>
		);
	}

	return (
		<>
			{state === "error" && (
				<p role="alert" className="mt-4 text-sm text-red-600">
					{error}
				</p>
			)}
			<Button className="mt-6 w-full" disabled={state === "submitting"} onClick={completeLink}>
				{state === "submitting" ? "Linking…" : "Confirm and link accounts"}
			</Button>
		</>
	);
}
