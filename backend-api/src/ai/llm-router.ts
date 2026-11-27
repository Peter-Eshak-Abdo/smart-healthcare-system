import { GoogleGenAI } from '@google/genai';
import { request as undiciRequest } from 'undici';
import type { z } from 'zod';
import type { AppEnv } from '../config/env.js';
import { estimateTokens } from './prompt-compressor.js';

export type ModelTier = 'tier1' | 'tier2';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface LlmRouterResult<T> {
  data: T;
  provider: 'gemini' | 'groq' | 'deterministic_fallback';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmGenerateOptions<T> {
  tier?: ModelTier;
  systemPrompt: string;
  messages: LlmMessage[];
  schema: z.ZodType<T>;
  fallback: () => T;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const jsonSlice =
    firstBrace >= 0 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;
  return JSON.parse(jsonSlice);
}

// Tracks rate-limited Gemini API keys with cooldown timestamp (ms)
const keyCooldownUntil = new Map<string, number>();

export function resetKeyCooldownsForTest(): void {
  keyCooldownUntil.clear();
}

export function parseGeminiKeyPool(
  env: Partial<Pick<AppEnv, 'GEMINI_API_KEY' | 'GEMINI_API_KEYS'>>,
): string[] {
  const keys = new Set<string>();
  if (env.GEMINI_API_KEYS) {
    for (const part of env.GEMINI_API_KEYS.split(',')) {
      const k = part.trim();
      if (k.length >= 10) keys.add(k);
    }
  }
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length >= 10) {
    keys.add(env.GEMINI_API_KEY.trim());
  }
  return Array.from(keys);
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('quota');
}

export class LlmRouter {
  private readonly geminiKeys: string[];
  private readonly tier1GeminiModels: string[];
  private readonly tier2GeminiModels: string[];
  private readonly groqApiKey: string | undefined;
  private readonly groqTier1Model: string;
  private readonly groqTier2Model: string;

  constructor(
    env: Partial<
      Pick<
        AppEnv,
        | 'GEMINI_API_KEY'
        | 'GEMINI_API_KEYS'
        | 'GEMINI_MODEL'
        | 'GEMINI_TIER1_MODEL'
        | 'GEMINI_TIER2_MODEL'
        | 'GROQ_API_KEY'
        | 'GROQ_MODEL'
        | 'GROQ_TIER1_MODEL'
        | 'GROQ_TIER2_MODEL'
      >
    >,
  ) {
    this.geminiKeys = parseGeminiKeyPool(env);
    this.tier1GeminiModels = Array.from(
      new Set([env.GEMINI_TIER1_MODEL || 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']),
    );
    this.tier2GeminiModels = Array.from(
      new Set([env.GEMINI_TIER2_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite']),
    );
    this.groqApiKey = env.GROQ_API_KEY;
    this.groqTier1Model = env.GROQ_TIER1_MODEL || 'llama-3.1-8b-instant';
    this.groqTier2Model = env.GROQ_TIER2_MODEL || env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  hasLiveProvider(): boolean {
    return this.geminiKeys.length > 0 || Boolean(this.groqApiKey);
  }

  async generateStructured<T>(opts: LlmGenerateOptions<T>): Promise<LlmRouterResult<T>> {
    const tier = opts.tier ?? 'tier1';
    const temperature = opts.temperature ?? 0.2;
    const maxTokens = opts.maxTokens ?? (tier === 'tier1' ? 300 : 400);
    const timeoutMs = opts.timeoutMs ?? 8_000;

    const inputText = `${opts.systemPrompt}\n${opts.messages.map((m) => m.content).join('\n')}`;
    const estInputTokens = estimateTokens(inputText);
    const hasImage = opts.messages.some((m) => Boolean(m.imageBase64));

    const geminiModels = tier === 'tier1' ? this.tier1GeminiModels : this.tier2GeminiModels;
    const now = Date.now();
    const activeKeys = this.geminiKeys.filter((k) => (keyCooldownUntil.get(k) ?? 0) <= now);
    const keysToTry = activeKeys.length > 0 ? activeKeys : this.geminiKeys;

    // 1. Primary: Google Gemini with Key Pool Rotation + Tiered Model Fallback
    for (const apiKey of keysToTry) {
      for (const model of geminiModels) {
        try {
          const rawText = await this.callGemini(
            apiKey,
            model,
            opts.systemPrompt,
            opts.messages,
            temperature,
            maxTokens,
            timeoutMs,
          );
          const parsed = extractJsonObject(rawText);
          const validated = opts.schema.safeParse(parsed);
          if (validated.success) {
            return {
              data: validated.data,
              provider: 'gemini',
              model,
              inputTokens: estInputTokens + (hasImage ? 258 : 0),
              outputTokens: estimateTokens(rawText),
            };
          }
        } catch (err) {
          if (isRateLimitError(err)) {
            // Put this key on 60s cooldown and immediately rotate to next key
            keyCooldownUntil.set(apiKey, Date.now() + 60_000);
            break;
          }
          // Otherwise try next Gemini model
        }
      }
    }

    // 2. Secondary: Groq API (text-only fallback)
    if (this.groqApiKey && !hasImage) {
      const groqModel = tier === 'tier1' ? this.groqTier1Model : this.groqTier2Model;
      try {
        const rawText = await this.callGroq(
          groqModel,
          opts.systemPrompt,
          opts.messages,
          temperature,
          maxTokens,
          timeoutMs,
        );
        const parsed = extractJsonObject(rawText);
        const validated = opts.schema.safeParse(parsed);
        if (validated.success) {
          return {
            data: validated.data,
            provider: 'groq',
            model: groqModel,
            inputTokens: estInputTokens,
            outputTokens: estimateTokens(rawText),
          };
        }
      } catch {
        // Fall through to deterministic RAG fallback
      }
    }

    // 3. Tier 3: Zero-Cost Deterministic Local Fallback
    return {
      data: opts.fallback(),
      provider: 'deterministic_fallback',
      model: 'local-rag-v2',
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  protected async callGemini(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: LlmMessage[],
    temperature: number,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string> {
    const client = new GoogleGenAI({ apiKey });
    const contents = messages.map((m) => {
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
        { text: m.content },
      ];
      if (m.imageBase64) {
        parts.push({
          inlineData: {
            data: m.imageBase64,
            mimeType: m.imageMimeType ?? 'image/jpeg',
          },
        });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await Promise.race([
        client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        }),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('Gemini timeout')));
        }),
      ]);

      const text = response.text;
      if (!text) throw new Error('Empty Gemini response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  protected async callGroq(
    model: string,
    systemPrompt: string,
    messages: LlmMessage[],
    temperature: number,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string> {
    if (!this.groqApiKey) throw new Error('Groq API key not configured');

    const res = await undiciRequest('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.groqApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Groq HTTP ${res.statusCode}`);
    }

    const body = (await res.body.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty Groq response');
    return content;
  }
}
