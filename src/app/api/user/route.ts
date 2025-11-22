import { AUTH_USER_CACHE_KEY, AUTH_USER_ID_CACHE_KEY } from "@/lib/constants/auth";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { cookies } from "next/headers";
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

export async function DELETE() {
        const cookieStore = await cookies();
        try {
                cookieStore.delete(AUTH_USER_CACHE_KEY);
                cookieStore.delete(AUTH_USER_ID_CACHE_KEY);
        } catch (err) {
                console.warn("Failed to clear cached auth cookies", err);
        }

        return NextResponse.json({ cleared: true }, { status: 200 });
}
