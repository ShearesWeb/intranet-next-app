import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    const supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll() {
                    // Intentionally disabled.
                    // Middleware must not mutate auth cookies server-side.
                },
            },
        }
    )

    // Refreshing and validating the auth token via verified claims.
    const { data, error } = await supabase.auth.getClaims()
    const isAuthenticated = Boolean(data?.claims?.sub)

    const path = request.nextUrl.pathname;

    if (error) {
        // If we are already on an auth page, allow the request to proceed so the user can log in
        if (path.startsWith('/auth')) {
            return supabaseResponse
        }

        // Only log actual errors, not just "session missing" which is expected for unauthenticated users
        if (!error.message.includes('Auth session missing')) {
            console.error('Error getting user:', error)
        }

        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    if (!isAuthenticated && path.startsWith('/dashboard')) {
        // no user, respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    if (isAuthenticated && path.startsWith('/auth')) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse
}
