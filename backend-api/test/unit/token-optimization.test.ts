import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { explainPrescription } from '../../src/ai/clinical/prescription-explainer.js';
import { runDynamicClinicalSafety } from '../../src/ai/clinical/safety-engine.js';
import { summarizePatientHistory } from '../../src/ai/clinical/summarizer.js';
import { LlmRouter, resetKeyCooldownsForTest } from '../../src/ai/llm-router.js';
import {
  detectChronicAnomalies,
  detectPrescriptionFraud,
} from '../../src/ai/local-first.js';
import { scrubPii } from '../../src/ai/pii.js';
import { compressHistory, estimateTokens } from '../../src/ai/prompt-compressor.js';
import { consumeAiQuota, resetAiQuotasForTest } from '../../src/ai/quota-guard.js';
import { runAssistantTriage } from '../../src/ai/triage/assistant-engine.js';

const OFFLINE_ENV = {
  GEMINI_API_KEY: undefined,
  GEMINI_API_KEYS: undefined,
  GROQ_API_KEY: undefined,
};

describe('Ultra-Low-Token AI 7 Pillars', () => {
  it('Cache hits return in 0 LLM calls for Rx Explainer & Patient Summary', async () => {
    const firstRx = await explainPrescription(OFFLINE_ENV, {
      prescriptionId: 'rx-cache-test-001',
      locale: 'ar',
      items: [{ drug_id: 'drug-paracetamol-500', drug_name: 'Panadol', dose: '500mg' }],
    });
    expect(firstRx.provider).toBe('deterministic_fallback');

    const secondRx = await explainPrescription(OFFLINE_ENV, {
      prescriptionId: 'rx-cache-test-001',
      locale: 'ar',
      items: [{ drug_id: 'drug-paracetamol-500', drug_name: 'Panadol', dose: '500mg' }],
    });
    expect(secondRx.provider).toBe('cache');

    const firstSum = await summarizePatientHistory(OFFLINE_ENV, {
      patientId: 'pat-cache-test-001',
      lastRecordUpdatedAt: '2026-11-27T10:00:00Z',
      locale: 'ar',
      ageBand: '35-54',
      sex: 'male',
      allergies: [],
      conditions: [],
      medications: [],
      recentEncounters: [],
    });
    expect(firstSum.provider).toBe('deterministic_fallback');

    const secondSum = await summarizePatientHistory(OFFLINE_ENV, {
      patientId: 'pat-cache-test-001',
      lastRecordUpdatedAt: '2026-11-27T10:00:00Z',
      locale: 'ar',
      ageBand: '35-54',
      sex: 'male',
      allergies: [],
      conditions: [],
      medications: [],
      recentEncounters: [],
    });
    expect(secondSum.provider).toBe('cache');
  });

  it('Red-flag symptoms, DDI, chronic anomalies, and fraud detection execute with 0 LLM tokens', async () => {
    const triage = await runAssistantTriage(OFFLINE_ENV, {
      locale: 'ar',
      message: 'عندي ألم شديد في الصدر مع عرق ونهجان',
      history: [],
      patientContext: { age_band: '55-69', sex: 'male' },
    });
    expect(triage.triage.level).toBe('emergency');
    expect(triage.llm_used).toBe(false);

    const safety = await runDynamicClinicalSafety(OFFLINE_ENV, {
      proposed: [{ key: 'p1', drug_id: 'IBUPROFEN_400' }],
      current: [{ key: 'c1', drug_id: 'WARFARIN_5', from_restricted_record: false }],
      allergies: [],
      conditions: [],
      locale: 'ar',
    });
    expect(safety.alerts.length).toBeGreaterThan(0);

    const anomalies = detectChronicAnomalies([
      { type: 'blood_pressure', systolic: 120, diastolic: 80, recorded_at: '2026-11-20T10:00:00Z' },
      { type: 'blood_pressure', systolic: 185, diastolic: 122, recorded_at: '2026-11-27T10:00:00Z' },
      { type: 'blood_glucose', value: 62, recorded_at: '2026-11-27T10:00:00Z' },
    ]);
    expect(anomalies.length).toBe(2);
    expect(anomalies.every((a) => a.tokens_used === 0)).toBe(true);

    const fraud = detectPrescriptionFraud([
      {
        id: 'rx-1',
        patient_id: 'p1',
        doctor_id: 'd1',
        created_at: '2026-11-27T02:00:00Z',
        drug_ids: ['TRAMADOL_50'],
        signature_valid: false,
      },
      {
        id: 'rx-2',
        patient_id: 'p1',
        doctor_id: 'd2',
        created_at: '2026-11-27T03:00:00Z',
        drug_ids: ['TRAMADOL_50'],
      },
    ]);
    expect(fraud.some((f) => f.rule === 'tampered_signature')).toBe(true);
    expect(fraud.some((f) => f.rule === 'duplicate_controlled_rx')).toBe(true);
    expect(fraud.every((f) => f.tokens_used === 0)).toBe(true);
  });

  it('Key pool rotates on simulated 429 and falls back to Groq -> Local RAG cleanly', async () => {
    resetKeyCooldownsForTest();

    class TestRouter extends LlmRouter {
      readonly geminiCalls: string[] = [];
      override async callGemini(apiKey: string, model: string): Promise<string> {
        this.geminiCalls.push(`${apiKey}:${model}`);
        if (apiKey === 'key-one-123456') {
          throw new Error('429 RESOURCE_EXHAUSTED');
        }
        return JSON.stringify({ ok: true });
      }
    }

    const r1 = new TestRouter({
      GEMINI_API_KEYS: 'key-one-123456,key-two-123456',
      GROQ_API_KEY: 'groq-test-123456',
    });
    const out1 = await r1.generateStructured({
      tier: 'tier1',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hi' }],
      schema: z.object({ ok: z.boolean() }),
      fallback: () => ({ ok: false }),
    });
    expect(out1.provider).toBe('gemini');
    expect(out1.data.ok).toBe(true);
    expect(r1.geminiCalls.some((c) => c.startsWith('key-two-123456'))).toBe(true);

    // Now test Groq fallback when all Gemini keys fail, then Local RAG fallback when Groq fails
    class GroqFallbackRouter extends LlmRouter {
      override async callGemini(): Promise<string> {
        throw new Error('429 RESOURCE_EXHAUSTED');
      }
      override async callGroq(): Promise<string> {
        return JSON.stringify({ via: 'groq' });
      }
    }
    const r2 = new GroqFallbackRouter({
      GEMINI_API_KEYS: 'key-three-123456',
      GROQ_API_KEY: 'groq-test-123456',
    });
    const out2 = await r2.generateStructured({
      tier: 'tier1',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hi' }],
      schema: z.object({ via: z.string() }),
      fallback: () => ({ via: 'local' }),
    });
    expect(out2.provider).toBe('groq');
    expect(out2.data.via).toBe('groq');
  });

  it('Chat history sliding window caps token size and strips PII', () => {
    const longHistory = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      text: `Message ${i} رقمي القومي 29901011234567 ورقمي 01012345678`,
    }));

    const { rollingSummary, recentTurns } = compressHistory(longHistory);
    expect(recentTurns.length).toBe(4);
    expect(rollingSummary).not.toBeNull();
    expect(estimateTokens(rollingSummary ?? '')).toBeLessThanOrEqual(65);
    expect(rollingSummary).not.toContain('29901011234567');
    expect(recentTurns[0]?.text).toContain('[NATIONAL_ID]');
    expect(scrubPii('01112345678')).toBe('[PHONE]');
  });

  it('Per-user daily AI quota guard enforces limits', async () => {
    resetAiQuotasForTest();
    const env = { AI_DAILY_LIMIT_PATIENT_VISION: 2 };
    await consumeAiQuota({ env, userId: 'u-quota-1', bucket: 'patient_vision', locale: 'ar' });
    await consumeAiQuota({ env, userId: 'u-quota-1', bucket: 'patient_vision', locale: 'ar' });
    await expect(
      consumeAiQuota({ env, userId: 'u-quota-1', bucket: 'patient_vision', locale: 'ar' }),
    ).rejects.toThrow();
  });
});
