import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PROTECTED_SEGMENTS = ['/doctor', '/pharmacy', '/er', '/admin', '/print'];

export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  // Optimistic session cookie check (authoritative check runs in SSR requireRole & backend-api)
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_SEGMENTS.some((seg) => pathname.includes(seg));
  if (isProtected) {
    const hasSessionCookie = Boolean(request.cookies.get('sh_id_token')?.value);

    if (!hasSessionCookie && process.env.NEXT_PUBLIC_ALLOW_DEMO_SHELL !== 'true') {
      const locale = pathname.startsWith('/en') ? 'en' : 'ar';
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('next', pathname);
      return Response.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
