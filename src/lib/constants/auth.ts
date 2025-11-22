export const AUTH_USER_CACHE_KEY = "authenticated_user";
export const AUTH_USER_ID_CACHE_KEY = "user_id";

// Keep authenticated user data responsive to role/appointment changes.
// Used by both server and client caches.
export const AUTH_USER_CACHE_TTL_SECONDS = 60 * 10; // 10 minutes
