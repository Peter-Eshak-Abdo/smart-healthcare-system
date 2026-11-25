import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' https: data:",
  `connect-src 'self' ${apiOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspDirectives },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/:locale/(doctor|pharmacy|er|admin|print)/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
