import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../firebase/firestore-types.js';

interface CacheEntry<T> {
  value: T;
  expiresAtMs: number | null; // null = permanent
}

const MAX_MEMORY_ENTRIES = 500;

export function buildAiCacheKey(
  featureName: string,
  normalizedInput: string,
  contextHash = '',
): string {
  return createHash('sha256')
    .update(`${featureName}::${normalizedInput}::${contextHash}`)
    .digest('hex');
}

export class TwoTierAiCache {
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly db: Firestore | null = null) {}

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const memHit = this.memory.get(key);
    if (memHit) {
      if (memHit.expiresAtMs !== null && memHit.expiresAtMs <= now) {
        this.memory.delete(key);
      } else {
        // Refresh LRU position
        this.memory.delete(key);
        this.memory.set(key, memHit);
        return memHit.value as T;
      }
    }

    if (this.db) {
      try {
        const snap = await this.db.collection(COLLECTIONS.aiCache).doc(key).get();
        if (snap.exists) {
          const data = snap.data() as {
            payload?: unknown;
            expires_at_ms?: number | null;
          };
          if (
            data.expires_at_ms === null ||
            data.expires_at_ms === undefined ||
            data.expires_at_ms > now
          ) {
            this.setMemory(key, data.payload, data.expires_at_ms ?? null);
            return data.payload as T;
          }
        }
      } catch {
        // Cache read failure never breaks AI execution
      }
    }

    return null;
  }

  async set<T>(
    key: string,
    value: T,
    opts?: { ttlSeconds?: number | null; feature?: string },
  ): Promise<void> {
    const ttlSeconds = opts?.ttlSeconds;
    const expiresAtMs =
      ttlSeconds !== undefined && ttlSeconds !== null
        ? Date.now() + ttlSeconds * 1000
        : null;

    this.setMemory(key, value, expiresAtMs);

    if (this.db) {
      try {
        await this.db.collection(COLLECTIONS.aiCache).doc(key).set({
          feature: opts?.feature ?? 'generic',
          payload: value,
          expires_at_ms: expiresAtMs,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Non-fatal
      }
    }
  }

  private setMemory(key: string, value: unknown, expiresAtMs: number | null): void {
    if (this.memory.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey !== undefined) {
        this.memory.delete(oldestKey);
      }
    }
    this.memory.set(key, { value, expiresAtMs });
  }
}

let sharedCache: TwoTierAiCache | null = null;

export function getAiCache(db?: Firestore | null): TwoTierAiCache {
  if (db) {
    return new TwoTierAiCache(db);
  }
  if (!sharedCache) {
    sharedCache = new TwoTierAiCache(null);
  }
  return sharedCache;
}
