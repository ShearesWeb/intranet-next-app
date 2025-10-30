// src/middleware.ts
import { updateSession } from '@/utils/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/dashboard/:path*',  // All dashboard pages
    '/auth/:path*',       // All auth pages
  ]
}