// src/middleware.ts
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
