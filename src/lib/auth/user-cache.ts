import { AUTH_USER_CACHE_KEY, AUTH_USER_CACHE_TTL_SECONDS, AUTH_USER_ID_CACHE_KEY } from "@/lib/constants/auth";
import { AuthenticatedUser, CachedAuthenticatedUser } from "@/types/User";

const SECONDS = 1000;

export const isCacheFresh = (cachedAt: number) => (Date.now() - cachedAt * SECONDS) < AUTH_USER_CACHE_TTL_SECONDS * SECONDS;

export const parseCachedUser = (raw?: string | null): CachedAuthenticatedUser | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as CachedAuthenticatedUser;
        if (!parsed?.user || typeof parsed.cachedAt !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
};

export const serializeCachedUser = (user: AuthenticatedUser): string => JSON.stringify({
    user,
    cachedAt: Math.floor(Date.now() / SECONDS),
} satisfies CachedAuthenticatedUser);

export const clearClientUserCache = () => {
    if (typeof document === "undefined") return;
    document.cookie = `${AUTH_USER_CACHE_KEY}=; path=/; max-age=0`;
    document.cookie = `${AUTH_USER_ID_CACHE_KEY}=; path=/; max-age=0`;
};

export const readCookie = (key: string): string | null => {
    if (typeof document === "undefined") return null;
    return document.cookie
        .split(";")
        .map((v) => v.trim())
        .find((cookie) => cookie.startsWith(`${key}=`))
        ?.split("=")[1] ?? null;
};

export const getFreshUserFromCookie = (): AuthenticatedUser | null => {
    const raw = readCookie(AUTH_USER_CACHE_KEY);
    const cached = parseCachedUser(raw);
    if (!cached) return null;
    if (!isCacheFresh(cached.cachedAt)) return null;
    return cached.user;
};
