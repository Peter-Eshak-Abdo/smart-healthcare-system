/**
 * Strips personally identifiable information (PII) before any text leaves
 * the backend boundary to external LLM providers (Gemini / Groq).
 */
const NATIONAL_ID_RE = /\b[23]\d{13}\b/g;
const EGYPT_PHONE_RE = /(?:\+?20|0)?1[0125]\d{8}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const LONG_DIGITS_RE = /\b\d{9,}\b/g;

export function scrubPii(input: string, knownNames: string[] = []): string {
  let out = input
    .replace(NATIONAL_ID_RE, '[NATIONAL_ID]')
    .replace(EGYPT_PHONE_RE, '[PHONE]')
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(IBAN_RE, '[IBAN]')
    .replace(LONG_DIGITS_RE, '[ID_NUMBER]');

  for (const name of knownNames) {
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'gi'), '[PATIENT]');
    }
  }
  return out;
}

export function sanitizeHistory(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  knownNames: string[] = [],
): Array<{ role: 'user' | 'assistant'; text: string }> {
  return history.slice(-8).map((turn) => ({
    role: turn.role,
    text: scrubPii(turn.text, knownNames),
  }));
}
