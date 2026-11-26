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
 * In-memory Redis subset used ONLY when neither REDIS_URL nor Upstash REST credentials
 * are configured in local/test runs.
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

/**
 * Upstash REST Redis adapter using Node fetch (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
 */
export class UpstashRestRedis implements RedisClientLike {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
    private readonly logger: Logger,
  ) {}

  private async exec(command: Array<string | number>): Promise<unknown> {
    const res = await fetch(this.restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      const msg = `Upstash REST HTTP ${res.status}`;
      this.logger.warn({ status: res.status }, msg);
      throw new Error(msg);
    }
    const payload = (await res.json()) as { result?: unknown; error?: string };
    if (payload.error) {
      this.logger.warn({ err: payload.error }, 'Upstash REST command error');
      throw new Error(payload.error);
    }
    return payload.result ?? null;
  }

  async get(key: string): Promise<string | null> {
    const out = await this.exec(['GET', key]);
    return out === null || out === undefined ? null : String(out);
  }

  async set(
    key: string,
    value: string,
    _mode: 'EX',
    seconds: number,
    flag?: 'NX',
  ): Promise<unknown> {
    const cmd: Array<string | number> = ['SET', key, value, 'EX', seconds];
    if (flag === 'NX') cmd.push('NX');
    return this.exec(cmd);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const out = await this.exec(['DEL', ...keys]);
    return Number(out ?? 0);
  }

  async ping(): Promise<string> {
    const out = await this.exec(['PING']);
    return String(out ?? 'PONG');
  }

  async quit(): Promise<string> {
    return 'OK';
  }
}

export function createRedisClient(
  redisUrl: string | undefined,
  logger: Logger,
  upstashRest?: { url?: string | undefined; token?: string | undefined },
): {
  raw: Redis | null;
  client: RedisClientLike;
} {
  if (redisUrl) {
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

  if (upstashRest?.url && upstashRest.token) {
    return {
      raw: null,
      client: new UpstashRestRedis(upstashRest.url, upstashRest.token, logger),
    };
  }

  return { raw: null, client: new InMemoryRedis() };
}
