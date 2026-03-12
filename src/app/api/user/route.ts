import { AUTH_USER_CACHE_KEY, AUTH_USER_ID_CACHE_KEY } from "@/lib/constants/auth";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { cookies } from "next/headers";
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
                                        headers: { "Cache-Control": "no-store, private" }
                                }
			);
		}

		return NextResponse.json(user, {
                        status: 200,
                        headers: { "Cache-Control": "no-store, private" }
                });
	} catch (err) {
		console.error("Error fetching user info:", err);
                return NextResponse.json(
                        { error: "Internal server error" },
                        {
                                status: 500,
                                headers: { "Cache-Control": "no-store, private" }
                        }
                );
        }
}

export async function DELETE() {
        const cookieStore = await cookies();
        try {
                // Legacy cleanup: remove old app-level user cache cookies.
                cookieStore.delete(AUTH_USER_CACHE_KEY);
                cookieStore.delete(AUTH_USER_ID_CACHE_KEY);
        } catch (err) {
                console.warn("Failed to clear cached auth cookies", err);
        }

        return NextResponse.json(
                { cleared: true },
                {
                        status: 200,
                        headers: { "Cache-Control": "no-store, private" }
                }
        );
}
