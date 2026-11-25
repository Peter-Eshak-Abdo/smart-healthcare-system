import { Router } from 'express';
import { request as undiciRequest } from 'undici';
import type { AppDeps } from '../../app-deps.js';
import { exportPublicJwk } from '../../security/crypto/keyring.js';

export function systemRoutes(deps: AppDeps): Router {
  const router = Router();
  const { env } = deps;

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT,
    });
  });

  router.get('/ready', async (_req, res) => {
    let dbOk = false;
    if (deps.pools) {
      try {
        await deps.pools.defaultPool.query('select 1');
        dbOk = true;
      } catch {
        dbOk = false;
      }
    }

    let redisOk = false;
    try {
      const pong = await deps.redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    let aiOk = false;
    if (deps.aiReadiness) {
      aiOk = await deps.aiReadiness.ping().catch(() => false);
    } else if (env.AI_SERVICE_URL) {
      try {
        const aiRes = await undiciRequest(`${env.AI_SERVICE_URL}/internal/v1/health`, {
          method: 'GET',
          headersTimeout: 1500,
          bodyTimeout: 1500,
        });
        aiOk = aiRes.statusCode === 200;
      } catch {
        aiOk = false;
      }
    }

    const ready = dbOk && redisOk;
    res.status(ready ? 200 : 503).json({
      db: dbOk ? 'ok' : 'down',
      redis: redisOk ? 'ok' : 'down',
      ai: aiOk ? 'ok' : 'degraded',
    });
  });

  router.get('/.well-known/rx-jwks.json', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      keys: deps.keyring.rxPublicKeys.map(exportPublicJwk),
    });
  });

  router.get('/.well-known/emergency-card-jwks.json', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      keys: deps.keyring.emergencyCardPublicKeys.map(exportPublicJwk),
    });
  });

  router.get('/config/mobile', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      min_version: {
        android: env.MIN_CLIENT_VERSION_ANDROID,
        ios: env.MIN_CLIENT_VERSION_IOS,
      },
      emergency_phone: env.EMERGENCY_PHONE,
      feature_flags: {
        er_intake: env.FEATURE_ER_INTAKE,
        passkey: env.FEATURE_PASSKEY,
      },
    });
  });

  return router;
}
