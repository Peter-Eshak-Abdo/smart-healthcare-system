import pino, { type Logger } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-step-up-token"]',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.id_document_number',
  '*.id_document_enc',
  '*.phone',
  '*.phone_enc',
  '*.full_name_enc',
  '*.notes_internal',
  '*.notes_internal_enc',
  '*.patient_summary',
  '*.chief_complaint',
  '*.embedding',
  '*.frames',
  '*.secret',
  '*.privateKey',
];

export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
  });
}

export function sanitizeErrorForLog(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
    };
  }
  return { message: 'Unknown non-Error thrown' };
}
