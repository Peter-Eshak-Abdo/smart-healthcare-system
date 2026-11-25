import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import { z } from 'zod';
import { AccountStatusSchema, AppRoleSchema } from '@smarthealth/contracts';
import type { AppEnv } from '../config/env.js';
import type { FirebaseAdminPort } from '../firebase/firebase-admin.js';
import { AppError } from '../shared/errors.js';

export const VerifiedClaimsSchema = z
  .object({
    sub: z.string().min(1),
    exp: z.number().int(),
    iat: z.number().int(),
    auth_time: z.number().int().optional(),
    aal: z.enum(['aal1', 'aal2']).default('aal1'),
    session_id: z.string().optional(),
    app_role: AppRoleSchema.default('patient'),
    account_status: AccountStatusSchema.default('pending_verification'),
    session_epoch: z.number().int().nonnegative().default(0),
    amr: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type VerifiedClaims = z.infer<typeof VerifiedClaimsSchema>;

export type AccessTokenVerifier = (token: string) => Promise<VerifiedClaims>;

/**
 * Verifies Firebase Auth ID tokens via `firebase-admin` (including revocation check),
 * or falls back cleanly when optional custom OIDC test issuer env is supplied.
 */
export function createAccessTokenVerifier(
  env: AppEnv,
  firebaseAdmin: FirebaseAdminPort,
): AccessTokenVerifier {
  const customJwksUrl = process.env.FIREBASE_TEST_JWKS_URL;
  const customIssuer = process.env.FIREBASE_TEST_ISSUER;
  const remoteJwks =
    customJwksUrl && customIssuer
      ? createRemoteJWKSet(new URL(customJwksUrl), { cooldownDuration: 30_000 })
      : null;

  return async (token: string): Promise<VerifiedClaims> => {
    try {
      if (remoteJwks && customIssuer) {
        const { payload } = await jwtVerify(token, remoteJwks, {
          issuer: customIssuer,
          algorithms: ['ES256', 'RS256'],
          clockTolerance: 60,
        });
        return VerifiedClaimsSchema.parse(payload);
      }

      if (!env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new AppError('AUTH_TOKEN_INVALID', { detail: 'firebase_auth_unconfigured' });
      }

      const decoded = await firebaseAdmin.verifyIdToken(token, true);
      const rawRecord = decoded as unknown as Record<string, unknown>;
      const firebaseMeta = decoded.firebase as
        | { sign_in_second_factor?: string; sign_in_provider?: string }
        | undefined;
      const inferredAal =
        rawRecord.aal === 'aal2' || Boolean(firebaseMeta?.sign_in_second_factor)
          ? 'aal2'
          : 'aal1';

      return VerifiedClaimsSchema.parse({
        sub: decoded.uid,
        exp: decoded.exp,
        iat: decoded.iat,
        auth_time: decoded.auth_time,
        aal: inferredAal,
        app_role: rawRecord.role ?? rawRecord.app_role ?? 'patient',
        account_status: rawRecord.status ?? rawRecord.account_status ?? 'active',
        session_epoch:
          typeof rawRecord.session_epoch === 'number' ? rawRecord.session_epoch : 0,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (err instanceof joseErrors.JWTExpired || code === 'auth/id-token-expired') {
        throw new AppError('AUTH_TOKEN_EXPIRED', { cause: err });
      }
      if (code === 'auth/id-token-revoked') {
        throw new AppError('AUTH_SESSION_REVOKED', { cause: err });
      }
      throw new AppError('AUTH_TOKEN_INVALID', { cause: err });
    }
  };
}
