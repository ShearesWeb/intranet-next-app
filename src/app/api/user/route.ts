import { fetchUserInfo } from "@/lib/fetch-user-info";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
	try {
		const user = await fetchUserInfo();

		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{
					status: 404,
					headers: { "Cache-Control": "no-store, private" },
				},
			);
		}

		return NextResponse.json(user, {
			status: 200,
			headers: { "Cache-Control": "no-store, private" },
		});
	} catch (err) {
		console.error("Error fetching user info:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{
				status: 500,
				headers: { "Cache-Control": "no-store, private" },
			},
		);
	}
}
