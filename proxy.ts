import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Referral link handler: /r/[code] ──
  // Sets a 30-day cookie and redirects to signup
  if (pathname.startsWith('/r/')) {
    const code = pathname.replace('/r/', '').trim();

    if (code && code.length >= 6) {
      const signupUrl = new URL('/account/signup', request.url);
      signupUrl.searchParams.set('ref', code);

      const response = NextResponse.redirect(signupUrl);

      response.cookies.set('ref', code, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return response;
    }
  }

  // ── Protected path check ──
  const protectedPaths = [
    '/api/receipts',
    '/api/reports',
    '/dashboard',
  ];

  const isProtectedPath = protectedPaths.some(path =>
    pathname.startsWith(path)
  );

  if (isProtectedPath) {
    const user = await getSession();

    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/account/signin', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    '/r/:path*',
  ],
};