import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { loadEnv } from '../../config/env.js';
import { HybridRagKnowledgeBase } from './retriever.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../datasets/rag-embeddings.json');

async function main(): Promise<void> {
  const env = loadEnv();
  const kb = new HybridRagKnowledgeBase();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    process.stdout.write(
      'GEMINI_API_KEY not set — skipping remote vector generation; BM25 hybrid index remains active.\n',
    );
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const embeddings: Record<string, number[]> = {};
  for (const doc of kb.documents) {
    const res = await ai.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents: `${doc.title}\n${doc.text}`.slice(0, 2000),
    });
    const vec = res.embeddings?.[0]?.values;
    if (vec && vec.length > 0) {
      embeddings[doc.id] = vec;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(embeddings), 'utf8');
  process.stdout.write(`Built RAG embeddings index for ${Object.keys(embeddings).length} documents -> ${OUT_PATH}\n`);
}

main().catch((err) => {
  process.stderr.write(`ai:index failed: ${String(err)}\n`);
  process.exit(1);
});
