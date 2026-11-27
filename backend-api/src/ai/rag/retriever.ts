import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDatasetsDir = path.resolve(__dirname, '../datasets');
const fallbackSrcDatasetsDir = path.resolve(__dirname, '../../../src/ai/datasets');
const DATASETS_DIR = fs.existsSync(localDatasetsDir) ? localDatasetsDir : fallbackSrcDatasetsDir;

export interface DrugContraindication {
  icd10_prefix: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  note_en: string;
  note_ar: string;
}

export interface DrugDatasetEntry {
  id: string;
  code: string;
  brand_names_en: string[];
  brand_names_ar: string[];
  generic_name: string;
  generic_name_ar: string;
  active_ingredients: string[];
  drug_classes: string[];
  standard_dosage_adult: string;
  max_daily_dose_mg: number;
  timing_instructions_en: string;
  timing_instructions_ar: string;
  contraindications: DrugContraindication[];
  warnings_en: string;
  warnings_ar: string;
  side_effects_en: string[];
  side_effects_ar: string[];
  pregnancy_category: string;
}

export interface DdiDatasetRule {
  rule_id: string;
  ingredient_a: string;
  ingredient_b: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  mechanism_en: string;
  mechanism_ar: string;
  management_en: string;
  management_ar: string;
  alternatives_en: string[];
  alternatives_ar: string[];
}

export interface CrossReactivityDatasetRule {
  rule_id: string;
  allergen_class: string;
  target_class: string;
  severity_if_severe: 'minor' | 'moderate' | 'major' | 'contraindicated';
  severity_if_mild: 'minor' | 'moderate' | 'major' | 'contraindicated';
  note_en: string;
  note_ar: string;
}

export interface ConditionTriageEntry {
  id: string;
  specialty_code: string;
  specialty_name_en: string;
  specialty_name_ar: string;
  symptoms_ar: string[];
  symptoms_en: string[];
  red_flags_ar: string[];
  red_flags_en: string[];
  guidance_ar: string;
  guidance_en: string;
}

export interface RagDocument {
  id: string;
  kind: 'drug' | 'interaction' | 'triage';
  title: string;
  text: string;
  tokens: string[];
  embedding?: number[] | undefined;
  raw: DrugDatasetEntry | DdiDatasetRule | ConditionTriageEntry;
}

/**
 * Normalizes Arabic & English text for resilient BM25/keyword matching:
 * - Strips Arabic diacritics (tashkeel) and tatweel
 * - Normalizes Alef variants (أ/إ/آ -> ا), Teh Marbuta (ة -> ه), Alef Maksura (ى -> ي)
 * - Lowercases English
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const norm = normalizeText(input);
  if (!norm) return [];
  return norm.split(' ').filter((t) => t.length >= 2);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class HybridRagKnowledgeBase {
  readonly drugs: DrugDatasetEntry[];
  readonly ddiRules: DdiDatasetRule[];
  readonly crossRules: CrossReactivityDatasetRule[];
  readonly triageEntries: ConditionTriageEntry[];
  readonly documents: RagDocument[];
  private readonly idf: Map<string, number>;
  private readonly avgDocLen: number;

  constructor(opts?: {
    drugs?: DrugDatasetEntry[];
    ddiRules?: DdiDatasetRule[];
    crossRules?: CrossReactivityDatasetRule[];
    triageEntries?: ConditionTriageEntry[];
    embeddingsMap?: Record<string, number[]>;
  }) {
    this.drugs =
      opts?.drugs ??
      (JSON.parse(
        fs.readFileSync(path.join(DATASETS_DIR, 'drugs-dataset.json'), 'utf8'),
      ) as DrugDatasetEntry[]);

    const interactionsRaw = JSON.parse(
      fs.readFileSync(path.join(DATASETS_DIR, 'drug-interactions-dataset.json'), 'utf8'),
    ) as {
      ddi_rules: DdiDatasetRule[];
      cross_reactivity_rules: CrossReactivityDatasetRule[];
    };
    this.ddiRules = opts?.ddiRules ?? interactionsRaw.ddi_rules;
    this.crossRules = opts?.crossRules ?? interactionsRaw.cross_reactivity_rules;

    this.triageEntries =
      opts?.triageEntries ??
      (JSON.parse(
        fs.readFileSync(path.join(DATASETS_DIR, 'conditions-triage-dataset.json'), 'utf8'),
      ) as ConditionTriageEntry[]);

    let embeddingsMap = opts?.embeddingsMap;
    if (!embeddingsMap) {
      const embPath = path.join(DATASETS_DIR, 'rag-embeddings.json');
      if (fs.existsSync(embPath)) {
        try {
          embeddingsMap = JSON.parse(fs.readFileSync(embPath, 'utf8')) as Record<string, number[]>;
        } catch {
          embeddingsMap = undefined;
        }
      }
    }

    const docs: RagDocument[] = [];
    for (const d of this.drugs) {
      const text = [
        d.generic_name,
        d.generic_name_ar,
        ...d.brand_names_en,
        ...d.brand_names_ar,
        ...d.active_ingredients,
        ...d.drug_classes,
        d.timing_instructions_en,
        d.timing_instructions_ar,
        d.warnings_en,
        d.warnings_ar,
      ].join(' ');
      docs.push({
        id: d.id,
        kind: 'drug',
        title: `${d.generic_name} (${d.brand_names_ar[0] ?? d.brand_names_en[0] ?? ''})`,
        text,
        tokens: tokenize(text),
        embedding: embeddingsMap?.[d.id],
        raw: d,
      });
    }

    for (const r of this.ddiRules) {
      const text = [
        r.rule_id,
        r.ingredient_a,
        r.ingredient_b,
        r.severity,
        r.mechanism_en,
        r.mechanism_ar,
        r.management_en,
        r.management_ar,
      ].join(' ');
      docs.push({
        id: r.rule_id,
        kind: 'interaction',
        title: `${r.ingredient_a} + ${r.ingredient_b} (${r.severity})`,
        text,
        tokens: tokenize(text),
        embedding: embeddingsMap?.[r.rule_id],
        raw: r,
      });
    }

    for (const t of this.triageEntries) {
      const text = [
        t.specialty_code,
        t.specialty_name_en,
        t.specialty_name_ar,
        ...t.symptoms_ar,
        ...t.symptoms_en,
        ...t.red_flags_ar,
        ...t.red_flags_en,
        t.guidance_ar,
        t.guidance_en,
      ].join(' ');
      docs.push({
        id: t.id,
        kind: 'triage',
        title: `${t.specialty_name_ar} / ${t.specialty_name_en}`,
        text,
        tokens: tokenize(text),
        embedding: embeddingsMap?.[t.id],
        raw: t,
      });
    }

    this.documents = docs;

    // Compute BM25 IDF
    const df = new Map<string, number>();
    let totalLen = 0;
    for (const doc of docs) {
      totalLen += doc.tokens.length;
      for (const tok of new Set(doc.tokens)) {
        df.set(tok, (df.get(tok) ?? 0) + 1);
      }
    }
    this.avgDocLen = docs.length > 0 ? totalLen / docs.length : 1;
    this.idf = new Map<string, number>();
    for (const [tok, freq] of df.entries()) {
      this.idf.set(tok, Math.log(1 + (docs.length - freq + 0.5) / (freq + 0.5)));
    }
  }

  private bm25Score(queryTokens: string[], doc: RagDocument): number {
    if (queryTokens.length === 0 || doc.tokens.length === 0) return 0;
    const k1 = 1.5;
    const b = 0.75;
    const tfMap = new Map<string, number>();
    for (const t of doc.tokens) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    }

    let score = 0;
    for (const q of queryTokens) {
      const tf = tfMap.get(q) ?? 0;
      if (tf === 0) continue;
      const idf = this.idf.get(q) ?? 0.5;
      const num = tf * (k1 + 1);
      const den = tf + k1 * (1 - b + (b * doc.tokens.length) / this.avgDocLen);
      score += idf * (num / den);
    }
    return score;
  }

  async retrieve(
    query: string,
    opts?: {
      kind?: RagDocument['kind'] | 'all';
      topK?: number;
      geminiApiKey?: string | undefined;
      embeddingModel?: string | undefined;
    },
  ): Promise<Array<{ doc: RagDocument; score: number }>> {
    const kind = opts?.kind ?? 'all';
    const topK = opts?.topK ?? 5;
    const queryTokens = tokenize(query);

    let queryEmbedding: number[] | null = null;
    if (opts?.geminiApiKey && this.documents.some((d) => Boolean(d.embedding))) {
      try {
        const ai = new GoogleGenAI({ apiKey: opts.geminiApiKey });
        const res = await ai.models.embedContent({
          model: opts.embeddingModel ?? 'gemini-embedding-001',
          contents: query,
        });
        const vec = res.embeddings?.[0]?.values;
        if (vec && vec.length > 0) {
          queryEmbedding = vec;
        }
      } catch {
        queryEmbedding = null;
      }
    }

    const candidates = this.documents.filter((d) => kind === 'all' || d.kind === kind);
    const scored = candidates.map((doc) => {
      const bm25 = this.bm25Score(queryTokens, doc);
      const vecScore =
        queryEmbedding && doc.embedding ? Math.max(0, cosineSimilarity(queryEmbedding, doc.embedding)) : 0;
      const combined = queryEmbedding ? 0.55 * bm25 + 4.5 * vecScore : bm25;
      return { doc, score: combined };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  findDrugByQuery(nameOrId: string): DrugDatasetEntry | undefined {
    const norm = normalizeText(nameOrId);
    if (!norm) return undefined;
    return this.drugs.find(
      (d) =>
        normalizeText(d.id) === norm ||
        normalizeText(d.code) === norm ||
        normalizeText(d.generic_name).includes(norm) ||
        normalizeText(d.generic_name_ar).includes(norm) ||
        d.brand_names_en.some((b) => normalizeText(b).includes(norm) || norm.includes(normalizeText(b))) ||
        d.brand_names_ar.some((b) => normalizeText(b).includes(norm) || norm.includes(normalizeText(b))),
    );
  }
}

let sharedKnowledgeBase: HybridRagKnowledgeBase | null = null;

export function getKnowledgeBase(): HybridRagKnowledgeBase {
  if (!sharedKnowledgeBase) {
    sharedKnowledgeBase = new HybridRagKnowledgeBase();
  }
  return sharedKnowledgeBase;
}
