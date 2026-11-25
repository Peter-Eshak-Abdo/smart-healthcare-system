import { z } from 'zod';
import { LocaleSchema, LocalizedTextSchema, TimestampSchema, UuidSchema } from './common.js';

export const TriageLevelSchema = z.enum([
  'emergency',
  'urgent',
  'soon',
  'routine',
  'self_care',
]);

export const AssistantSessionParamSchema = z
  .object({
    sessionId: UuidSchema,
  })
  .strict();

export const CreateAssistantSessionRequestSchema = z
  .object({
    locale: LocaleSchema.default('ar'),
  })
  .strict();

export const CreateAssistantSessionResponseSchema = z
  .object({
    session_id: UuidSchema,
    disclaimer: LocalizedTextSchema,
    created_at: TimestampSchema,
  })
  .strict();

export const SendAssistantMessageRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    client_message_id: UuidSchema,
  })
  .strict();

export const AssistantMessageResponseSchema = z
  .object({
    message_id: UuidSchema,
    triage: z
      .object({
        level: TriageLevelSchema,
        red_flag: z.boolean(),
        red_flag_rule_ids: z.array(z.string()),
        source: z.enum(['rules', 'llm+rules', 'fallback']),
      })
      .strict(),
    reply: z
      .object({
        text: z.string(),
        self_care: z.array(z.string()),
        warning_signs: z.array(z.string()),
      })
      .strict(),
    recommended_specialty: z
      .object({
        code: z.string(),
        name: LocalizedTextSchema,
        reason: z.string().nullable(),
      })
      .strict(),
    follow_up_questions: z.array(z.string()),
    disclaimer: z.string(),
    emergency_action: z
      .object({
        type: z.literal('call'),
        phone: z.string(),
        label: LocalizedTextSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const AssistantSessionDetailResponseSchema = z
  .object({
    session_id: UuidSchema,
    locale: LocaleSchema,
    status: z.enum(['open', 'closed']),
    created_at: TimestampSchema,
    messages: z.array(
      z
        .object({
          id: UuidSchema,
          role: z.enum(['user', 'assistant']),
          text: z.string(),
          triage_level: TriageLevelSchema.nullable(),
          red_flag: z.boolean(),
          created_at: TimestampSchema,
        })
        .strict(),
    ),
  })
  .strict();
