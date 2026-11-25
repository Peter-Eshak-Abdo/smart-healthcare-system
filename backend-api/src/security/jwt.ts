import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import { z } from 'zod';
import { AccountStatusSchema, AppRoleSchema, UuidSchema } from '@smarthealth/contracts';
import type { AppEnv } from '../config/env.js';
import { AppError } from '../shared/errors.js';

export const VerifiedClaimsSchema = z
  .object({
    sub: UuidSchema,
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

export function createAccessTokenVerifier(env: AppEnv): AccessTokenVerifier {
  if (!env.SUPABASE_JWKS_URL || !env.SUPABASE_JWT_ISSUER) {
    return async () => {
      throw new AppError('AUTH_TOKEN_INVALID', { detail: 'jwt_verifier_unconfigured' });
    };
  }

  const issuer = env.SUPABASE_JWT_ISSUER;
  const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });

  return async (token: string): Promise<VerifiedClaims> => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: 'authenticated',
        algorithms: ['ES256'],
        clockTolerance: 60,
      });
      return VerifiedClaimsSchema.parse(payload);
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw new AppError('AUTH_TOKEN_EXPIRED', { cause: err });
      }
      throw new AppError('AUTH_TOKEN_INVALID', { cause: err });
    }
  };
}
