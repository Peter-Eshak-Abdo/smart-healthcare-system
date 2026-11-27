import type { Firestore } from 'firebase-admin/firestore';
import type { AppEnv } from '../config/env.js';
import { AppError } from '../shared/errors.js';

export type QuotaBucket = 'patient_chat' | 'patient_vision' | 'doctor' | 'pharmacist';

interface MemoryCounter {
  dateKey: string;
  count: number;
}

const memoryCounters = new Map<string, MemoryCounter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resolveDailyLimit(
  env: Partial<
    Pick<
      AppEnv,
      | 'AI_DAILY_LIMIT_PATIENT_CHAT'
      | 'AI_DAILY_LIMIT_PATIENT_VISION'
      | 'AI_DAILY_LIMIT_DOCTOR'
      | 'AI_DAILY_LIMIT_PHARMACIST'
    >
  >,
  bucket: QuotaBucket,
): number {
  switch (bucket) {
    case 'patient_chat':
      return env.AI_DAILY_LIMIT_PATIENT_CHAT ?? 25;
    case 'patient_vision':
      return env.AI_DAILY_LIMIT_PATIENT_VISION ?? 8;
    case 'doctor':
      return env.AI_DAILY_LIMIT_DOCTOR ?? 60;
    case 'pharmacist':
      return env.AI_DAILY_LIMIT_PHARMACIST ?? 40;
  }
}

export async function consumeAiQuota(opts: {
  db?: Firestore | null;
  env: Partial<
    Pick<
      AppEnv,
      | 'AI_DAILY_LIMIT_PATIENT_CHAT'
      | 'AI_DAILY_LIMIT_PATIENT_VISION'
      | 'AI_DAILY_LIMIT_DOCTOR'
      | 'AI_DAILY_LIMIT_PHARMACIST'
    >
  >;
  userId: string;
  bucket: QuotaBucket;
  locale?: 'ar' | 'en';
}): Promise<{ remaining: number; limit: number }> {
  const limit = resolveDailyLimit(opts.env, opts.bucket);
  const day = todayKey();
  const key = `${day}:${opts.bucket}:${opts.userId}`;

  const current = memoryCounters.get(key);
  const nextCount = current && current.dateKey === day ? current.count + 1 : 1;

  if (nextCount > limit) {
    throw new AppError('RATE_LIMITED', {
      statusOverride: 429,
      detail:
        opts.locale === 'en'
          ? 'Daily AI quota reached. Please use local search or try again tomorrow.'
          : 'وصلت للحد اليومي للذكاء الاصطناعي النهاردة. تقدر تستخدم البحث المحلي أو تجرب بكرة.',
    });
  }

  memoryCounters.set(key, { dateKey: day, count: nextCount });
  return { remaining: Math.max(0, limit - nextCount), limit };
}

export function resetAiQuotasForTest(): void {
  memoryCounters.clear();
}
