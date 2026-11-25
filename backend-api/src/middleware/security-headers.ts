import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AppEnv } from '../config/env.js';

export function httpLoggerMiddleware(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (_req, res) => String(res.locals.requestId ?? ''),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}

export function securityHeadersMiddleware(): RequestHandler[] {
  return [
    helmet({
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
    }),
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  ];
}

export function corsMiddleware(env: AppEnv): RequestHandler {
  const allowedOrigin = env.WEB_ORIGIN ?? false;
  return cors({
    origin: allowedOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept-Language',
      'X-Request-Id',
      'X-Client',
      'X-Device-Id',
      'Idempotency-Key',
      'X-Step-Up-Token',
      'If-Match',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'Idempotency-Replayed',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ],
  });
}
