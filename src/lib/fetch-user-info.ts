"use server"

import { AUTH_USER_CACHE_KEY, AUTH_USER_CACHE_TTL_SECONDS, AUTH_USER_ID_CACHE_KEY } from "@/lib/constants/auth";
import { isCacheFresh, parseCachedUser, serializeCachedUser } from "@/lib/auth/user-cache";
import { AuthenticatedUser } from "@/types/User";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function fetchUserInfo(ignoreCache = false): Promise<AuthenticatedUser | null> {
    const cookieStore = await cookies();
    const supabase = await createClient();

    const clearCachedUser = () => {
        try {
            cookieStore.delete(AUTH_USER_CACHE_KEY);
            cookieStore.delete(AUTH_USER_ID_CACHE_KEY);
        } catch {
            // RSC contexts can make cookie mutation a no-op
        }
    };

    // Ensure we have a valid authenticated user before trusting cached data
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();

    if (getUserError) {
        console.error("Error retrieving authenticated user:", getUserError);
    }

    if (!user) {
        clearCachedUser();
        console.log("No authenticated user found");
        return null;
    }

    if (!ignoreCache) {
        const cached = parseCachedUser(cookieStore.get(AUTH_USER_CACHE_KEY)?.value);

        if (cached && cached.user.email === user.email && isCacheFresh(cached.cachedAt)) {
            console.log("Using cached user info from cookies");
            return cached.user;
        }
    }

    console.log("Fetching user info from database for", user.email);
    const { data, error } = await supabase
        .from("authenticated_user_info")
        .select("id, email, name, room, points, profile_photo_path, appointments, is_admin, is_jcrc, is_culture_sports_admin")
        .eq("email", user.email)
        .single();

    if (error) throw error;
    if (!data) {
        clearCachedUser();
        console.log("No user info found in database for", user.email);
        return null;
    }

    const publicUrl = data.profile_photo_path
        ? supabase.storage.from("user-profile-pictures").getPublicUrl(data.profile_photo_path).data.publicUrl
        : null;

    const userInfo: AuthenticatedUser = {
        id: data.id,
        email: data.email,
        name: data.name,
        room: data.room,
        points: data.points,
        profile_photo_url: publicUrl,
        is_admin: data.is_admin,
        is_jcrc: data.is_jcrc,
        is_culture_sports_admin: data.is_culture_sports_admin,
        appointments: data.appointments ?? [],
    };

    // Store full user info in cookie
    try {
        cookieStore.set(AUTH_USER_CACHE_KEY, serializeCachedUser(userInfo), {
            httpOnly: false, // accessible from client AuthContext
            path: "/",
            maxAge: AUTH_USER_CACHE_TTL_SECONDS,
        });

        // Store fast-access user ID cookie
        cookieStore.set(AUTH_USER_ID_CACHE_KEY, data.id, {
            httpOnly: false,
            path: "/",
            maxAge: AUTH_USER_CACHE_TTL_SECONDS,
        });
    } catch {
        // Ignore cookie set failures in environments where mutation isn't allowed
    }

    return userInfo;
};


/**
 * Get the authenticated user's ID from cookie.
 * If missing, fetches user info and updates cookies.
 */
export async function fetchUserId(): Promise<number | null> {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get(AUTH_USER_ID_CACHE_KEY)?.value;
    const cachedUser = parseCachedUser(cookieStore.get(AUTH_USER_CACHE_KEY)?.value);

    let userId: number | null = null;

    if (cachedUser && isCacheFresh(cachedUser.cachedAt)) {
        userId = cachedUser.user.id;
    } else if (userIdCookie) {
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
