import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.js';
import { getErrorTitle } from '../shared/errors.js';
import { getRequestLocale } from '../shared/request-context.js';

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function clientVersionMiddleware(env: AppEnv): RequestHandler {
  return (req, res, next) => {
    const header = req.header('x-client');
    if (!header) {
      next();
      return;
    }

    const match = /^(web|mobile-android|mobile-ios)\/(\d+\.\d+\.\d+)$/.exec(header.trim());
    if (!match) {
      next();
      return;
    }

    const [, platform, version] = match;
    const min =
      platform === 'mobile-android'
        ? env.MIN_CLIENT_VERSION_ANDROID
        : platform === 'mobile-ios'
          ? env.MIN_CLIENT_VERSION_IOS
          : env.MIN_CLIENT_VERSION_WEB;

    if (version && compareSemver(version, min) < 0) {
      const locale = getRequestLocale();
      res
        .status(426)
        .type('application/problem+json')
        .json({
          type: 'https://docs.smarthealth.app/errors/CLIENT_UPGRADE_REQUIRED',
          title:
            locale === 'ar'
              ? 'يرجى تحديث التطبيق للمتابعة'
              : `${getErrorTitle('VALIDATION_FAILED', locale)}: client upgrade required`,
          status: 426,
          code: 'VALIDATION_FAILED',
          detail: `minimum_version:${min}`,
          instance: req.originalUrl.split('?')[0],
          request_id: res.locals.requestId,
        });
      return;
    }

    next();
  };
}
