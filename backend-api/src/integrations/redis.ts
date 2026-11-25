import { Redis } from 'ioredis';
import type { Logger } from 'pino';

export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number, flag?: 'NX'): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

/**
 * In-memory Redis subset used ONLY when REDIS_URL is omitted in local/test runs.
 */
export class InMemoryRedis implements RedisClientLike {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    _mode: 'EX',
    seconds: number,
    flag?: 'NX',
  ): Promise<'OK' | null> {
    const current = await this.get(key);
    if (flag === 'NX' && current !== null) {
      return null;
    }
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count += 1;
    }
    return count;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.store.clear();
    return 'OK';
  }
}

export function createRedisClient(redisUrl: string | undefined, logger: Logger): {
  raw: Redis | null;
  client: RedisClientLike;
} {
  if (!redisUrl) {
    return { raw: null, client: new InMemoryRedis() };
  }

  const raw = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  raw.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis connection warning');
  });

  return { raw, client: raw };
}
