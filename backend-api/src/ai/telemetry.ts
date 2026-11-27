import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../firebase/firestore-types.js';

export interface AiTelemetryEvent {
  feature: string;
  model: string;
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'local_zero_token' | 'cache';
  cacheHit: boolean;
  inputTokens: number;
  outputTokens: number;
  savedTokensEstimate: number;
  latencyMs: number;
  role: string;
  timestamp?: string;
}

const inMemoryMetrics: AiTelemetryEvent[] = [];

export async function recordAiTelemetry(
  db: Firestore | null,
  event: AiTelemetryEvent,
): Promise<void> {
  const record: AiTelemetryEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  inMemoryMetrics.push(record);
  if (inMemoryMetrics.length > 1000) {
    inMemoryMetrics.shift();
  }

  if (db) {
    try {
      await db.collection(COLLECTIONS.aiUsageMetrics).doc(randomUUID()).set({
        feature: record.feature,
        model: record.model,
        provider: record.provider,
        cache_hit: record.cacheHit,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        saved_tokens_estimate: record.savedTokensEstimate,
        latency_ms: record.latencyMs,
        role: record.role,
        timestamp: record.timestamp,
      });
    } catch {
      // Non-fatal
    }
  }
}

export interface AiTelemetrySummary {
  total_requests_today: number;
  cache_hit_rate: number;
  total_tokens_used_today: number;
  estimated_tokens_saved_today: number;
  zero_token_requests_today: number;
  providers: Record<string, number>;
}

export async function getAiTelemetrySummary(db: Firestore | null): Promise<AiTelemetrySummary> {
  const today = new Date().toISOString().slice(0, 10);
  let rows: Array<{
    cache_hit: boolean;
    input_tokens: number;
    output_tokens: number;
    saved_tokens_estimate: number;
    provider: string;
    timestamp: string;
  }> = [];

  if (db) {
    try {
      const snap = await db
        .collection(COLLECTIONS.aiUsageMetrics)
        .where('timestamp', '>=', `${today}T00:00:00.000Z`)
        .limit(500)
        .get();
      rows = snap.docs.map((d) => d.data() as (typeof rows)[number]);
    } catch {
      rows = [];
    }
  }

  if (rows.length === 0) {
    rows = inMemoryMetrics
      .filter((m) => (m.timestamp ?? '').startsWith(today))
      .map((m) => ({
        cache_hit: m.cacheHit,
        input_tokens: m.inputTokens,
        output_tokens: m.outputTokens,
        saved_tokens_estimate: m.savedTokensEstimate,
        provider: m.provider,
        timestamp: m.timestamp ?? today,
      }));
  }

  const total = rows.length;
  const cacheHits = rows.filter((r) => r.cache_hit).length;
  const zeroToken = rows.filter(
    (r) => r.cache_hit || r.provider === 'local_zero_token' || r.provider === 'deterministic_fallback',
  ).length;
  const tokensUsed = rows.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  const tokensSaved = rows.reduce((s, r) => s + (r.saved_tokens_estimate ?? 0), 0);
  const providers: Record<string, number> = {};
  for (const r of rows) {
    providers[r.provider] = (providers[r.provider] ?? 0) + 1;
  }

  return {
    total_requests_today: total,
    cache_hit_rate: total > 0 ? Number((cacheHits / total).toFixed(4)) : 0,
    total_tokens_used_today: tokensUsed,
    estimated_tokens_saved_today: tokensSaved,
    zero_token_requests_today: zeroToken,
    providers,
  };
}
