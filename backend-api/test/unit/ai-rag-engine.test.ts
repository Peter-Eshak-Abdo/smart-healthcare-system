import { describe, expect, it } from 'vitest';
import { analyzeFaceBiometric, transformEmbedding } from '../../src/ai/biometrics/face-engine.js';
import { explainPrescription } from '../../src/ai/clinical/prescription-explainer.js';
import { runDynamicClinicalSafety } from '../../src/ai/clinical/safety-engine.js';
import { summarizePatientHistory } from '../../src/ai/clinical/summarizer.js';
import { LlmRouter } from '../../src/ai/llm-router.js';
import { scrubPii } from '../../src/ai/pii.js';
import { getKnowledgeBase, normalizeText } from '../../src/ai/rag/retriever.js';
import { runSmartSearch } from '../../src/ai/search/smart-search.js';
import { runAssistantTriage } from '../../src/ai/triage/assistant-engine.js';
import { evaluateRedFlags } from '../../src/ai/triage/red-flags.js';
import { z } from 'zod';

const OFFLINE_ENV = {
  GEMINI_API_KEY: undefined,
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
  GROQ_API_KEY: undefined,
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  BIOMETRIC_TRANSFORM_SECRET: 'test-secret-key-32-chars-minimum',
  BIOMETRIC_TRANSFORM_KEY_VERSION: 1,
};

describe('Integrated AI + RAG Engine', () => {
  it('RAG retriever normalizes Arabic and matches Egyptian brand names', async () => {
    const kb = getKnowledgeBase();
    expect(normalizeText('أُوجْمَنتِين')).toBe('اوجمنتين');

    const hits = await kb.retrieve('أوجمنتين مضاد حيوي', { kind: 'drug', topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.doc.id).toBe('drug-amox-clav-1000');
  });

  it('PII redaction strips Egyptian national IDs, phones, emails, and names', () => {
    const raw = 'اسمي أحمد محمود رقمي القومي 29901011234567 وتليفوني 01012345678 وايميلي ahmed@test.com';
    const scrubbed = scrubPii(raw, ['أحمد محمود']);
    expect(scrubbed).not.toContain('29901011234567');
    expect(scrubbed).not.toContain('01012345678');
    expect(scrubbed).not.toContain('ahmed@test.com');
    expect(scrubbed).not.toContain('أحمد محمود');
    expect(scrubbed).toContain('[NATIONAL_ID]');
    expect(scrubbed).toContain('[PHONE]');
    expect(scrubbed).toContain('[EMAIL]');
    expect(scrubbed).toContain('[PATIENT]');
  });

  it('LLM router falls back deterministically when external providers are unavailable', async () => {
    const router = new LlmRouter(OFFLINE_ENV);
    const res = await router.generateStructured({
      systemPrompt: 'Test',
      messages: [{ role: 'user', content: 'Hello' }],
      schema: z.object({ ok: z.boolean() }),
      fallback: () => ({ ok: true }),
    });
    expect(res.provider).toBe('deterministic_fallback');
    expect(res.data.ok).toBe(true);
  });

  it('Red-flag triage catches cardiac & stroke emergencies in Egyptian Arabic', async () => {
    const rf = evaluateRedFlags('عندي وجع شديد في الصدر مع عرق ونهجان');
    expect(rf.highestLevel).toBe('emergency');
    expect(rf.ruleIds).toContain('RF-CARDIAC-01');

    const triage = await runAssistantTriage(OFFLINE_ENV, {
      locale: 'ar',
      message: 'وشي مايل ومش قادر أتكلم كويس',
      history: [],
      patientContext: { age_band: '55-69', sex: 'male' },
    });
    expect(triage.triage.level).toBe('emergency');
    expect(triage.triage.red_flag).toBe(true);
    expect(triage.triage.emergency_action).toBe('call_123');
    expect(triage.llm_used).toBe(false);
  });

  it('Clinical safety engine detects Warfarin+Ibuprofen DDI, Penicillin allergy cross-reactivity, and CKD risk', async () => {
    const res = await runDynamicClinicalSafety(OFFLINE_ENV, {
      proposed: [
        { key: 'item-1', drug_id: 'IBUPROFEN_400' },
        { key: 'item-2', drug_id: 'CEFUROXIME_500' },
      ],
      current: [{ key: 'cur-1', drug_id: 'WARFARIN_5', from_restricted_record: false }],
      allergies: [{ allergen_type: 'drug_class', allergen_code: 'CLS-PENICILLINS', severity: 'anaphylaxis' }],
      conditions: [{ icd10_code: 'N18.3' }],
      locale: 'ar',
    });

    expect(res.checks_status).toBe('complete');
    const types = new Set(res.alerts.map((a) => a.type));
    expect(types.has('drug_drug')).toBe(true);
    expect(types.has('drug_allergy')).toBe(true);
    expect(types.has('drug_condition')).toBe(true);
    expect(res.alerts.some((a) => a.severity === 'contraindicated')).toBe(true);
  });

  it('Patient history summarizer and prescription explainer produce structured RAG-grounded output', async () => {
    const summary = await summarizePatientHistory(OFFLINE_ENV, {
      locale: 'ar',
      ageBand: '35-54',
      sex: 'female',
      bloodType: 'O+',
      allergies: [{ name: 'Penicillin', severity: 'severe' }],
      conditions: [{ name: 'Hypertension', icd10: 'I10', status: 'active' }],
      medications: [{ name: 'Concor 5', dosage: '5mg daily', status: 'active' }],
      recentEncounters: [{ date: '2026-11-01', summary: 'Follow-up BP 130/80' }],
    });
    expect(summary.critical_alerts.length).toBeGreaterThan(0);
    expect(summary.active_medications[0]).toContain('Concor 5');

    const explained = await explainPrescription(OFFLINE_ENV, {
      locale: 'ar',
      items: [
        {
          drug_id: 'AMOX_CLAV_1000',
          drug_name: 'Augmentin 1g',
          dose: '1 قرص',
          frequency: 'كل 12 ساعة',
          duration_days: 7,
        },
      ],
    });
    expect(explained.items.length).toBe(1);
    expect(explained.items[0]?.timing_and_food).toContain('الأكل');
  });

  it('Smart search routes Egyptian Arabic symptom queries to the right specialty', async () => {
    const res = await runSmartSearch(OFFLINE_ENV, { query: 'حرقان في المعدة وحموضة', locale: 'ar' });
    expect(res.intent).toBe('symptom_triage');
    expect(res.recommended_specialty_code).toBe('gastroenterology');
  });

  it('Zero-Python biometric face engine produces deterministic cancellable embeddings', () => {
    const rawEmb = Array.from({ length: 128 }, (_, i) => Math.sin(i + 1));
    const t1 = transformEmbedding(rawEmb, 'secret-1', 1);
    const t2 = transformEmbedding(rawEmb, 'secret-1', 1);
    const tDiff = transformEmbedding(rawEmb, 'secret-2', 1);

    expect(t1).toEqual(t2);
    expect(t1).not.toEqual(tDiff);

    const analysis = analyzeFaceBiometric(OFFLINE_ENV, {
      mode: 'enroll',
      livenessMode: 'active',
      frames: [],
      clientEmbedding: rawEmb,
      clientLivenessScore: 0.95,
      clientQualityScore: 0.9,
    });
    expect(analysis.face_detected).toBe(true);
    expect(analysis.template?.dim).toBe(128);
  });
});
