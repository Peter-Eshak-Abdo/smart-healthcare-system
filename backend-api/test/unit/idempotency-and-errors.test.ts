import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { InMemoryRedis } from '../../src/integrations/redis.js';
import { errorHandlerMiddleware } from '../../src/middleware/error-handler.js';
import { idempotencyMiddleware } from '../../src/middleware/idempotency.js';
import { createRateLimitService } from '../../src/middleware/rate-limit.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { toAppError } from '../../src/shared/errors.js';
import { createLogger } from '../../src/shared/logger.js';

describe('idempotency, Firestore error mapping, and rate limiting', () => {
  it('replays identical idempotent POST and rejects modified payload', async () => {
    const redis = new InMemoryRedis();
    const app = express();
    app.use(requestIdMiddleware());
    app.use(express.json());
    app.use((_req, res, next) => {
      res.locals.auth = {
        userId: 'b0000000-0000-4000-8000-000000000001',
      } as NonNullable<Express.Locals['auth']>;
      next();
    });
    let executions = 0;
    app.post('/items', idempotencyMiddleware(redis, { required: true }), (req, res) => {
      executions += 1;
      res.status(201).json({ count: executions, name: req.body.name });
    });
    app.use(errorHandlerMiddleware(createLogger('silent'), null));

    const missing = await request(app).post('/items').send({ name: 'x' });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const key = randomUUID();
    const first = await request(app).post('/items').set('Idempotency-Key', key).send({ name: 'a' });
    expect(first.status).toBe(201);
    expect(first.body.count).toBe(1);

    const replay = await request(app).post('/items').set('Idempotency-Key', key).send({ name: 'a' });
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.count).toBe(1);

    const conflict = await request(app).post('/items').set('Idempotency-Key', key).send({ name: 'b' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('maps Firestore gRPC conflicts and ZodErrors cleanly to RFC 9457 AppErrors', () => {
    const dup = toAppError({ code: 6, message: 'ALREADY_EXISTS' });
    expect(dup.status).toBe(409);
    expect(dup.code).toBe('CONFLICT_VERSION');

    const aborted = toAppError({ code: 10, message: 'ABORTED' });
    expect(aborted.code).toBe('CONFLICT_VERSION');

    let zodErr: unknown;
    try {
      z.object({ count: z.number().int() }).parse({ count: 'bad' });
    } catch (e) {
      zodErr = e;
    }
    expect(zodErr).toBeInstanceOf(ZodError);
    expect(toAppError(zodErr).code).toBe('VALIDATION_FAILED');
  });

  it('enforces auth_ip rate limit with 429 RATE_LIMITED and Retry-After', async () => {
    const rateLimit = createRateLimitService(null);
    const app = express();
    app.use(requestIdMiddleware());
    app.use('/auth', rateLimit.middleware('auth_ip', () => '10.0.0.1'));
    app.post('/auth/login', (_req, res) => res.status(200).json({ ok: true }));
    app.use(errorHandlerMiddleware(createLogger('silent'), null));

    for (let i = 0; i < 10; i += 1) {
      const ok = await request(app).post('/auth/login');
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app).post('/auth/login').set('Accept-Language', 'ar');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeTruthy();
  });
});
