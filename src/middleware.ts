// src/middleware.ts
//
// Next.js 16 deprecates `middleware` in favour of `proxy`, and warns at build time.
// Keep this name for now: a proxy always runs on Node.js, and OpenNext builds Node.js
// middleware for Cloudflare only as an experimental, unmaintained feature. This is
// the auth gate, so it stays on the edge runtime OpenNext supports.
import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
	return await updateSession(request);
}

export const config = {
	matcher: [
		"/", // Landing page — runs middleware purely for foreign-projref cookie eviction.
		"/dashboard/:path*", // All dashboard pages
		"/auth/:path*", // All auth pages
	],
};
