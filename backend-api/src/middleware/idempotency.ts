import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { UuidSchema } from '@smarthealth/contracts';
import { toCanonicalJson } from '../security/crypto/jcs.js';
import { AppError } from '../shared/errors.js';

export interface IdempotencyRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number, flag?: 'NX'): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

interface StoredIdempotencyRecord {
  state: 'in_progress' | 'done';
  bodyHash: string;
  status?: number;
  body?: unknown;
}

function hashRequest(body: unknown, files: Express.Multer.File[] | undefined): string {
  const canonicalBody = toCanonicalJson(body ?? {});
  const hash = createHash('sha256').update(canonicalBody, 'utf8');
  if (files && files.length > 0) {
    for (const file of files) {
      hash.update(file.buffer);
    }
  }
  return hash.digest('hex');
}

export function idempotencyMiddleware(
  redis: IdempotencyRedis,
  opts: { required: boolean },
): RequestHandler {
  return async (req, res, next) => {
    const key = req.header('idempotency-key');
    if (!key) {
      next(opts.required ? new AppError('IDEMPOTENCY_KEY_REQUIRED') : undefined);
      return;
    }

    const parsedKey = UuidSchema.safeParse(key);
    if (!parsedKey.success) {
      next(new AppError('VALIDATION_FAILED', { detail: 'idempotency_key_format' }));
      return;
    }

    const userId = res.locals.auth?.userId ?? 'anon';
    const routePattern = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const redisKey = `idem:${userId}:${req.method}:${routePattern}:${key}`;
    const files = Array.isArray(req.files) ? req.files : undefined;
    const bodyHash = hashRequest(req.body, files);

    try {
      const existing = await redis.get(redisKey);
      if (existing) {
        const rec = JSON.parse(existing) as StoredIdempotencyRecord;
        if (rec.bodyHash !== bodyHash) {
          next(new AppError('IDEMPOTENCY_KEY_CONFLICT'));
          return;
        }
        if (rec.state === 'in_progress') {
          next(new AppError('IDEMPOTENCY_KEY_CONFLICT', { detail: 'in_progress' }));
          return;
        }
        res.setHeader('Idempotency-Replayed', 'true');
        res.status(rec.status ?? 200).json(rec.body);
        return;
      }

      await redis.set(
        redisKey,
        JSON.stringify({ state: 'in_progress', bodyHash } satisfies StoredIdempotencyRecord),
        'EX',
        60,
        'NX',
      );
      res.locals.idempotencyKey = key;

      const origJson = res.json.bind(res);
      res.json = ((payload: unknown) => {
        const status = res.statusCode;
        void (status < 500
          ? redis.set(
              redisKey,
              JSON.stringify({ state: 'done', bodyHash, status, body: payload } satisfies StoredIdempotencyRecord),
              'EX',
              86_400,
            )
          : redis.del(redisKey));
        return origJson(payload);
      }) as typeof res.json;

      next();
    } catch (err) {
      next(err);
    }
  };
}
