import { fetchUserInfo } from "@/lib/fetch-user-info";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	try {
		const user = await fetchUserInfo();

		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(user, { status: 200 });
	} catch (err) {
		console.error("Error fetching user info:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
