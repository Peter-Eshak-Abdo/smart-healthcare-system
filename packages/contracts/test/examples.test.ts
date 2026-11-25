import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MeResponseSchema, PatientOnboardingRequestSchema } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '../examples');

describe('contract examples', () => {
  it('validates patient onboarding example', () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(examplesDir, 'patient-onboarding.request.json'), 'utf8'),
    );
    expect(() => PatientOnboardingRequestSchema.parse(raw)).not.toThrow();
  });

  it('validates GET /v1/me example', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(examplesDir, 'me.response.json'), 'utf8'));
    expect(() => MeResponseSchema.parse(raw)).not.toThrow();
  });
});
