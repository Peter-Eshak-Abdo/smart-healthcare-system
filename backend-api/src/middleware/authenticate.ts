import type { Request, RequestHandler } from 'express';
import { STAFF_ROLES, ROLE_PERMISSIONS } from '../security/permissions.js';
import type { AuthContextService } from '../security/auth-context.js';
import type { AccessTokenVerifier } from '../security/jwt.js';
import { AppError } from '../shared/errors.js';

const PENDING_PATIENT_ROUTES: Array<{ method: string; pathPrefix: string }> = [
  { method: 'GET', pathPrefix: '/me' },
  { method: 'POST', pathPrefix: '/patients/me/onboarding' },
  { method: 'POST', pathPrefix: '/patients/me/consents' },
];

function isPendingAllowedRoute(req: Request): boolean {
  const path = req.path;
  return PENDING_PATIENT_ROUTES.some(
    (rule) => req.method === rule.method && (path === rule.pathPrefix || path === `/v1${rule.pathPrefix}`),
  );
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

      if (STAFF_ROLES.has(ctx.role) && claims.aal !== 'aal2') {
        throw new AppError('AUTH_MFA_REQUIRED');
      }

      if (ctx.role !== 'admin' && ctx.role !== 'patient' && !ctx.licenceValid) {
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
