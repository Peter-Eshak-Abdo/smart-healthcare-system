import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Logger } from 'pino';
import { writeAuditLog } from '../security/audit.js';
import { AppError, getErrorTitle, toAppError } from '../shared/errors.js';
import { sanitizeErrorForLog } from '../shared/logger.js';
import { getRequestLocale } from '../shared/request-context.js';

export function notFoundMiddleware(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError('RESOURCE_NOT_FOUND', { detail: `route_not_found:${req.method}:${req.path}` }));
  };
}

export function errorHandlerMiddleware(logger: Logger, db: Firestore | null): ErrorRequestHandler {
  return (err, req, res, _next) => {
    void _next;
    const appErr = toAppError(err);
    const locale = res.locals.locale ?? getRequestLocale();

    if (appErr.status >= 500) {
      logger.error(
        {
          err: sanitizeErrorForLog(err),
          code: appErr.code,
          request_id: res.locals.requestId,
        },
        'Unhandled backend error',
      );
    }

    if (appErr.audit && db) {
      const auth = res.locals.auth ?? null;
      void writeAuditLog(db, auth, {
        action: 'ACCESS_DENIED',
        resourceType: 'http_route',
        outcome: 'denied',
        reason: appErr.code,
        metadata: {
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: appErr.status,
        },
      }).catch(() => {
        // Non-fatal if Firestore unavailable during denial logging
      });
    }

    res
      .status(appErr.status)
      .type('application/problem+json')
      .json({
        type: `https://docs.smarthealth.app/errors/${appErr.code}`,
        title: getErrorTitle(appErr.code, locale),
        status: appErr.status,
        code: appErr.code,
        ...(appErr.detail ? { detail: appErr.detail } : {}),
        instance: req.originalUrl.split('?')[0],
        request_id: res.locals.requestId,
        ...(appErr.errors ? { errors: appErr.errors } : {}),
        ...(appErr.extra ?? {}),
      });
  };
}
