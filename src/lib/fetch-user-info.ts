'use server'

import { User } from "@/types/User";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function fetchUserInfo(ignoreCache = false): Promise<User | null> {
    const cookieStore = await cookies();
    const supabase = await createClient();

    const clearCachedUser = () => {
        try {
            cookieStore.delete("authenticated_user");
            cookieStore.delete("user_id");
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
        const cached = cookieStore.get("authenticated_user")?.value;
        if (cached) {
            try {
                const cachedUser = JSON.parse(cached) as User;
                // Only use cache if it matches the signed-in user
                if (cachedUser.email === user.email) {
                    console.log("Using cached user info from cookies");
                    return cachedUser;
                }
            } catch {
                // Invalid JSON → ignore and refresh
            }
        }
    }

    console.log("Fetching user info from database for", user.email);
    const { data, error } = await supabase
        .from("authenticated_user_info")
        .select("id, email, name, room, points, profile_photo_path, is_admin ,is_jcrc")
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
    try {
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
