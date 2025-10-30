'use server'

import { User } from "@/types/User";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function fetchUserInfo(ignoreCache = false): Promise<User | null> {
    // Check if user item is stored in cookies
    const cookieStore = await cookies();

    if (!ignoreCache) {
        const cached = cookieStore.get("authenticated_user")?.value;
        if (cached) {
            try {
                console.log("Using cached user info from cookies");
                const user = JSON.parse(cached) as User;
                return user;
            } catch {
                // Invalid JSON → ignore and refresh
            }
        }
    }

    // Get the authenticated Supabase user
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        console.log("No authenticated user found");
        return null;
    }

    console.log("Fetching user info from database for", user.email);
    const { data, error } = await supabase
        .from("authenticated_user_info")
        .select("id, email, name, room, points, profile_photo_path, is_admin ,is_jcrc")
        .eq("email", user.email)
        .single();

    if (error) throw error;
    if (!data) {
        console.log("No user info found in database for", user.email);
        return null;
    }

    const publicUrl = data.profile_photo_path
        ? supabase.storage.from("user-profile-pictures").getPublicUrl(data.profile_photo_path).data.publicUrl
        : null;

    const userInfo: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        room: data.room,
        points: data.points,
        profile_photo_url: publicUrl,
        is_admin: data.is_admin,
        is_jcrc: data.is_jcrc,
    };

    // Store full user info in cookie
    cookieStore.set("authenticated_user", JSON.stringify(userInfo), {
        httpOnly: false, // accessible from client AuthContext
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Store fast-access user ID cookie
    cookieStore.set("user_id", data.id, {
        httpOnly: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });
    return userInfo;
};


/**
 * Get the authenticated user's ID from cookie.
 * If missing, fetches user info and updates cookies.
 */
export async function fetchUserId(): Promise<number | null> {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("user_id")?.value;

    let userId: number | null = null;

    if (userIdCookie) {
        const parsed = Number(userIdCookie);
        if (!isNaN(parsed)) {
            userId = parsed;
        } else {
            console.warn("User ID cookie is corrupted, reloading user info");
        }
    }

    if (userId !== null) {
        return userId;
    }

    // Cookie missing or corrupted → reload full user
    const user = await fetchUserInfo(true); // ignore cache to refresh
    if (user) {
        return user.id;
    }

    // No user found
    return null;
}
