import type { Request, RequestHandler } from 'express';
import { ROLE_PERMISSIONS } from '../security/permissions.js';
import type { AuthContextService } from '../security/auth-context.js';
import type { AccessTokenVerifier } from '../security/jwt.js';
import { AppError } from '../shared/errors.js';

const PENDING_PATIENT_ROUTES: Array<{ method: string; pathPrefix: string }> = [
  { method: 'GET', pathPrefix: '/me' },
  { method: 'POST', pathPrefix: '/patients/me/onboarding' },
  { method: 'POST', pathPrefix: '/patients/me/consents' },
];

/** Routes a clinician whose licence is not (yet) verified may still call, so clients can show status. */
const UNLICENSED_STAFF_ROUTES: Array<{ method: string; pathPrefix: string }> = [
  { method: 'GET', pathPrefix: '/me' },
  { method: 'POST', pathPrefix: '/auth/logout' },
];

function matchesRoute(req: Request, rules: Array<{ method: string; pathPrefix: string }>): boolean {
  const path = req.path;
  return rules.some(
    (rule) =>
      req.method === rule.method && (path === rule.pathPrefix || path === `/v1${rule.pathPrefix}`),
  );
}

function isPendingAllowedRoute(req: Request): boolean {
  return matchesRoute(req, PENDING_PATIENT_ROUTES);
}

export function authenticateMiddleware(
  verifyJwt: AccessTokenVerifier,
  authContext: AuthContextService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const raw = req.header('authorization');
      if (!raw || !raw.startsWith('Bearer ')) {
        throw new AppError('AUTH_TOKEN_MISSING');
      }

      const token = raw.slice(7).trim();
      if (!token) {
        throw new AppError('AUTH_TOKEN_MISSING');
      }

      const claims = await verifyJwt(token);
      const ctx = await authContext.load(claims.sub);
      if (!ctx) {
        throw new AppError('AUTH_TOKEN_INVALID', { detail: 'profile_not_found' });
      }

      const pendingAllowed =
        ctx.role === 'patient' &&
        ctx.status === 'pending_verification' &&
        isPendingAllowedRoute(req);

      if (ctx.status !== 'active' && !pendingAllowed) {
        throw new AppError('ACCOUNT_SUSPENDED');
      }

      if (claims.session_epoch < ctx.sessionEpoch || claims.app_role !== ctx.role) {
        throw new AppError('AUTH_SESSION_REVOKED');
      }

      if (
        ctx.role !== 'admin' &&
        ctx.role !== 'patient' &&
        !ctx.licenceValid &&
        !matchesRoute(req, UNLICENSED_STAFF_ROUTES)
      ) {
        throw new AppError('LICENSE_NOT_VALID');
      }

      res.locals.auth = {
        ...ctx,
        claims,
        permissions: new Set(ROLE_PERMISSIONS[ctx.role]),
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
