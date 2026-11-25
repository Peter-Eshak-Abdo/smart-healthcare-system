import type { Request, RequestHandler } from 'express';
import type { Redis } from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { AppError } from '../shared/errors.js';

export type RateBucket =
  | 'auth_ip'
  | 'global_user'
  | 'emergency_identify_min'
  | 'emergency_identify_hour'
  | 'emergency_manual_search'
  | 'rx_check'
  | 'rx_verify_fail'
  | 'share_code_fail'
  | 'assistant_msg'
  | 'biometric_enroll_fail'
  | 'liveness_fail'
  | 'otp_send';

interface BucketConfig {
  points: number;
  duration: number;
  blockDuration?: number;
}

const BUCKET_CONFIGS: Record<RateBucket, BucketConfig> = {
  auth_ip: { points: 10, duration: 60, blockDuration: 60 },
  global_user: { points: 300, duration: 60, blockDuration: 60 },
  emergency_identify_min: { points: 5, duration: 60, blockDuration: 60 },
  emergency_identify_hour: { points: 20, duration: 3600, blockDuration: 3600 },
  emergency_manual_search: { points: 5, duration: 3600, blockDuration: 3600 },
  rx_check: { points: 60, duration: 60, blockDuration: 30 },
  rx_verify_fail: { points: 10, duration: 3600, blockDuration: 3600 },
  share_code_fail: { points: 5, duration: 900, blockDuration: 900 },
  assistant_msg: { points: 30, duration: 3600, blockDuration: 3600 },
  biometric_enroll_fail: { points: 5, duration: 3600, blockDuration: 86_400 },
  liveness_fail: { points: 3, duration: 600 },
  otp_send: { points: 3, duration: 900, blockDuration: 900 },
};

export interface RateLimitService {
  consume(bucket: RateBucket, key: string, points?: number): Promise<{ limit: number; remaining: number; resetSec: number }>;
  middleware(bucket: RateBucket, keyFn?: (req: Request, userId?: string) => string): RequestHandler;
}

export function createRateLimitService(redis: Redis | null): RateLimitService {
  const limiters = new Map<RateBucket, RateLimiterRedis | RateLimiterMemory>();

  for (const [bucket, cfg] of Object.entries(BUCKET_CONFIGS) as Array<[RateBucket, BucketConfig]>) {
    const baseOpts = {
      keyPrefix: `rl:${bucket}`,
      points: cfg.points,
      duration: cfg.duration,
      ...(cfg.blockDuration !== undefined ? { blockDuration: cfg.blockDuration } : {}),
    };
    const memory = new RateLimiterMemory(baseOpts);

    if (redis) {
      limiters.set(
        bucket,
        new RateLimiterRedis({
          storeClient: redis,
          ...baseOpts,
          insuranceLimiter: memory,
        }),
      );
    } else {
      limiters.set(bucket, memory);
    }
  }

  const consume = async (bucket: RateBucket, key: string, points = 1) => {
    const limiter = limiters.get(bucket)!;
    const cfg = BUCKET_CONFIGS[bucket];
    try {
      const result = await limiter.consume(key, points);
      return {
        limit: cfg.points,
        remaining: Math.max(0, result.remainingPoints),
        resetSec: Math.max(1, Math.ceil(result.msBeforeNext / 1000)),
      };
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const retryAfter = Math.max(1, Math.ceil(err.msBeforeNext / 1000));
        throw new AppError('RATE_LIMITED', {
          detail: `rate_limit_${bucket}`,
          extra: { retry_after: retryAfter },
        });
      }
      throw err;
    }
  };

  return {
    consume,
    middleware(bucket, keyFn) {
      return async (req, res, next) => {
        const userId = res.locals.auth?.userId;
        const key = keyFn ? keyFn(req, userId) : (userId ?? req.ip ?? 'unknown');
        try {
          const info = await consume(bucket, key, 1);
          res.setHeader('RateLimit-Limit', String(info.limit));
          res.setHeader('RateLimit-Remaining', String(info.remaining));
          res.setHeader('RateLimit-Reset', String(info.resetSec));
          next();
        } catch (err) {
          if (err instanceof AppError && err.extra?.retry_after) {
            res.setHeader('Retry-After', String(err.extra.retry_after));
          }
          next(err);
        }
      };
    },
  };
}
