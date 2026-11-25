import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, type BiometricTemplateDoc } from './firestore-types.js';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface FaceCandidateMatch {
  patient_id: string;
  score: number;
}

/**
 * Matches transformed orthogonal face templates in Firestore `biometric_templates`
 * using cosine similarity cleanly without pgvector.
 */
export async function matchFaceTemplates(
  db: Firestore,
  vector: number[],
  opts: {
    keyVersion: number;
    limit?: number;
  },
): Promise<FaceCandidateMatch[]> {
  const snap = await db
    .collection(COLLECTIONS.biometricTemplates)
    .where('status', '==', 'active')
    .where('key_version', '==', opts.keyVersion)
    .limit(500)
    .get();

  const bestByPatient = new Map<string, number>();
  for (const doc of snap.docs) {
    const t = doc.data() as BiometricTemplateDoc;
    const score = cosineSimilarity(vector, t.transformed_vector ?? []);
    const prev = bestByPatient.get(t.patient_id);
    if (prev === undefined || score > prev) {
      bestByPatient.set(t.patient_id, score);
    }
  }

  return [...bestByPatient.entries()]
    .map(([patient_id, score]) => ({ patient_id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
}
