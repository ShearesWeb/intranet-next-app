import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);

    // Extract auth code and optional redirect path
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (!code) return NextResponse.redirect(`${origin}/auth/auth-error?reason=no_code`);

    const supabase = await createClient();

    // Exchange the auth code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/auth/auth-error?reason=code_exchange_failed`);

    try {
        const userItem = await fetchUserInfo(true);
        if (!userItem) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/auth/login?reason=user_not_found`);
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?reason=user_not_found`);
    }

    // Redirect to the intended path or fallback to homepage
    return NextResponse.redirect(`${origin}${next}`);
}
