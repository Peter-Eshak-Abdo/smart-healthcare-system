import { scrubPii } from './pii.js';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Sliding window over chat history:
 * - Keeps at most the last 4 turns verbatim (PII-scrubbed).
 * - Summarizes earlier turns into a compact <= 60-token (~240-char) rolling summary.
 */
export function compressHistory(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  knownNames: string[] = [],
): {
  rollingSummary: string | null;
  recentTurns: Array<{ role: 'user' | 'assistant'; text: string }>;
} {
  const scrubbed = history.map((h) => ({
    role: h.role,
    text: scrubPii(h.text, knownNames).trim(),
  }));

  if (scrubbed.length <= 4) {
    return { rollingSummary: null, recentTurns: scrubbed };
  }

  const older = scrubbed.slice(0, -4);
  const recentTurns = scrubbed.slice(-4);

  const userSnippets = older
    .filter((t) => t.role === 'user')
    .map((t) => t.text.slice(0, 55))
    .join('; ');
  const compact = userSnippets.slice(0, 220);

  return {
    rollingSummary: compact ? `Earlier context: ${compact}` : null,
    recentTurns,
  };
}

/**
 * Caps RAG context to max 3 chunks and <= 350 tokens (~1400 chars) total.
 */
export function compressRagChunks(
  chunks: Array<{ id: string; title: string; text: string }>,
  maxChunks = 3,
  maxTotalChars = 1400,
): string {
  const selected = chunks.slice(0, maxChunks);
  const lines: string[] = [];
  let usedChars = 0;

  for (const c of selected) {
    const line = `[${c.id}] ${c.title}: ${c.text}`.slice(0, 480);
    if (usedChars + line.length > maxTotalChars) {
      const remaining = maxTotalChars - usedChars;
      if (remaining > 40) {
        lines.push(line.slice(0, remaining));
      }
      break;
    }
    lines.push(line);
    usedChars += line.length;
  }

  return lines.join('\n');
}
