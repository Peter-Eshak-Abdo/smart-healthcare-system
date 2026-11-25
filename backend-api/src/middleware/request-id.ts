import type { Locale } from '@smarthealth/contracts';
import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '../shared/request-context.js';

function parseLocale(headerVal: string | undefined): Locale {
  if (!headerVal) return 'en';
  const lower = headerVal.toLowerCase();
  if (lower.startsWith('ar') || lower.includes('ar-')) return 'ar';
  return 'en';
}

export function requestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && /^[0-9a-f-]{36}$/i.test(incoming) ? incoming : randomUUID();
    const locale = parseLocale(req.header('accept-language'));
    res.locals.requestId = requestId;
    res.locals.locale = locale;
    res.setHeader('X-Request-Id', requestId);

    requestContext.run(
      {
        requestId,
        locale,
        ...(req.ip ? { ip: req.ip } : {}),
        ...(req.header('user-agent') ? { userAgent: req.header('user-agent') } : {}),
      },
      () => next(),
    );
  };
}
