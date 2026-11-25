import type { StepUpPurpose } from '@smarthealth/contracts';
import type { RequestHandler } from 'express';
import type { Permission } from '../security/permissions.js';
import type { StepUpService } from '../security/step-up.js';
import { AppError } from '../shared/errors.js';

export function requirePermission(...required: Permission[]): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth;
    if (!auth) {
      next(new AppError('AUTH_TOKEN_MISSING'));
      return;
    }

    const ok = required.every((perm) => auth.permissions.has(perm));
    if (!ok) {
      next(new AppError('RBAC_FORBIDDEN', { detail: `missing_permission:${required.join(',')}` }));
      return;
    }
    next();
  };
}

export function requireRole(...roles: Array<'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin'>): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth;
    if (!auth) {
      next(new AppError('AUTH_TOKEN_MISSING'));
      return;
    }
    if (!roles.includes(auth.role)) {
      next(new AppError('RBAC_FORBIDDEN'));
      return;
    }
    next();
  };
}

export function requireStepUp(stepUp: StepUpService, purpose: StepUpPurpose): RequestHandler {
  return async (req, res, next) => {
    try {
      const auth = res.locals.auth;
      if (!auth) {
        throw new AppError('AUTH_TOKEN_MISSING');
      }
      const token = req.header('x-step-up-token');
      if (!token) {
        throw new AppError('AUTH_STEP_UP_REQUIRED', { detail: `step_up_required:${purpose}` });
      }
      await stepUp.verifyToken(token, auth.userId, purpose);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRecentAuth(maxAgeSec = 300): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth;
    if (!auth) {
      next(new AppError('AUTH_TOKEN_MISSING'));
      return;
    }
    const authTime = auth.claims.auth_time ?? auth.claims.iat;
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authTime > maxAgeSec) {
      next(new AppError('AUTH_STEP_UP_REQUIRED', { detail: 'reauth_totp' }));
      return;
    }
    next();
  };
}
