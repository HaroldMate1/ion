/**
 * OAuth Callback Handler
 * Handles the OAuth redirect after successful authentication
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // On Vercel, x-forwarded-host has the real public host (e.g. ion-app.vercel.app)
  // request.url may have an internal origin — always prefer the forwarded host
  const forwardedHost = request.headers.get('x-forwarded-host');
  const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;

  if (code) {
    // Create response that we'll modify with cookies
    const response = NextResponse.redirect(`${origin}/dashboard`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                // Ensure cookies work in production
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(`${origin}/login?error=authentication_failed`);
    }

    return response;
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
