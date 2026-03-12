"use server"

import { AuthenticatedUser } from "@/types/User";
import { createClient } from "@/utils/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

type JwtClaims = Record<string, unknown>;

const INTERNAL_USER_ID_CLAIM_KEYS = [
    "app_user_id",
    "intranet_user_id",
    "internal_user_id",
] as const;

function parseNumberClaim(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function getStringClaim(claims: JwtClaims | null, key: string): string | null {
    if (!claims) return null;
    const value = claims[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

async function getVerifiedClaims(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<JwtClaims | null> {
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
        // Session-missing is normal for unauthenticated requests.
        if (!error.message.includes("Auth session missing")) {
            console.error("Error retrieving verified claims:", error);
        }
        return null;
    }

    return (data?.claims ?? null) as JwtClaims | null;
}

async function resolveAuthenticatedEmail(
    supabase: Awaited<ReturnType<typeof createClient>>,
    claims: JwtClaims | null
): Promise<string | null> {
    const claimEmail = getStringClaim(claims, "email");
    if (claimEmail) return claimEmail;

    // Fallback for environments where claims don't include email.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && !error.message.includes("Auth session missing")) {
        console.error("Error retrieving authenticated user:", error);
    }
    return user?.email ?? null;
}

function resolveInternalUserIdFromClaims(claims: JwtClaims | null): number | null {
    if (!claims) return null;

    for (const key of INTERNAL_USER_ID_CLAIM_KEYS) {
        const parsed = parseNumberClaim(claims[key]);
        if (parsed !== null) return parsed;
    }

    return null;
}

export async function fetchUserInfo(): Promise<AuthenticatedUser | null> {
    noStore();
    const supabase = await createClient();
    const claims = await getVerifiedClaims(supabase);
    const userEmail = await resolveAuthenticatedEmail(supabase, claims);

    if (!userEmail) {
        console.log("No authenticated user found");
        return null;
    }

    const { data, error } = await supabase
        .from("authenticated_user_info")
        .select("id, email, name, room, points, profile_photo_path, appointments, is_admin, is_jcrc, is_culture_sports_admin")
        .eq("email", userEmail)
        .single();

    if (error) throw error;
    if (!data) {
        console.log("No user info found in database for", userEmail);
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

    return userInfo;
};


/**
 * Get the authenticated user's ID using the active Supabase session.
 */
export async function fetchUserId(): Promise<number | null> {
    noStore();
    const supabase = await createClient();
    const claims = await getVerifiedClaims(supabase);
    const internalUserIdFromClaims = resolveInternalUserIdFromClaims(claims);
    if (internalUserIdFromClaims !== null) return internalUserIdFromClaims;

    const userEmail = await resolveAuthenticatedEmail(supabase, claims);
    if (!userEmail) return null;

    const { data, error: dbError } = await supabase
        .from("authenticated_user_info")
        .select("id")
        .eq("email", userEmail)
        .single();

    if (dbError) {
        console.error("Error retrieving user ID from database:", dbError);
        return null;
    }

    if (!data) {
        return null;
    }

    return data.id;
}
