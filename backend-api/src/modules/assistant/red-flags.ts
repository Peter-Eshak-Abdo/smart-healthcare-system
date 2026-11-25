import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

interface RawRedFlagRule {
  id: string;
  level: 'emergency' | 'urgent';
  category?: string;
  any_of?: string[][];
  with_any?: string[][];
  response_template: string;
}

interface RawRedFlagsYaml {
  version: string;
  rules: RawRedFlagRule[];
}

const NEGATORS = new Set(['no', 'not', 'without', 'never', 'مفيش', 'مش', 'لا', 'بدون']);

function normalizeArabicEn(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/(.)\1{2,}/g, '$1')
    .toLowerCase()
    .replace(/\b3ndy\b|\b3andy\b/g, 'عندي')
    .replace(/\balam\s+f[ei]\s+sadry\b/g, 'الم في الصدر')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RedFlagFallbackResult {
  matched: boolean;
  level: 'emergency' | 'urgent' | 'soon';
  ruleIds: string[];
  isCrisis: boolean;
}

let cachedYaml: RawRedFlagsYaml | null = null;

function loadRedFlagsYaml(): RawRedFlagsYaml {
  if (cachedYaml) return cachedYaml;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '../../../../packages/contracts/red-flags.yaml'),
    path.resolve(process.cwd(), '../packages/contracts/red-flags.yaml'),
    path.resolve(process.cwd(), 'packages/contracts/red-flags.yaml'),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    cachedYaml = { version: 'fallback', rules: [] };
    return cachedYaml;
  }
  cachedYaml = yaml.parse(fs.readFileSync(filePath, 'utf8')) as RawRedFlagsYaml;
  return cachedYaml;
}

export function evaluateRedFlagsFallback(text: string): RedFlagFallbackResult {
  const doc = loadRedFlagsYaml();
  const norm = normalizeArabicEn(text);
  const hits: RawRedFlagRule[] = [];

  for (const rule of doc.rules) {
    const groups = [...(rule.any_of ?? []), ...(rule.with_any ?? [])];
    if (groups.length === 0) continue;
    const ignoreNegation = rule.level === 'emergency' && groups.length >= 2;
    const allMatch = groups.every((group) =>
      group.some((rawTerm) => {
        const term = normalizeArabicEn(rawTerm);
        const idx = norm.indexOf(term);
        if (idx === -1) return false;
        if (ignoreNegation) return true;
        const prefixTokens = norm.slice(0, idx).trim().split(/\s+/).slice(-2);
        return !prefixTokens.some((tok) => NEGATORS.has(tok));
      }),
    );
    if (allMatch) {
      hits.push(rule);
    }
  }

  if (hits.length === 0) {
    return { matched: false, level: 'soon', ruleIds: [], isCrisis: false };
  }
  const hasEmergency = hits.some((h) => h.level === 'emergency');
  return {
    matched: true,
    level: hasEmergency ? 'emergency' : 'urgent',
    ruleIds: hits.map((h) => h.id),
    isCrisis: hits.some((h) => h.category === 'crisis'),
  };
}
