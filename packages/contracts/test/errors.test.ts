import { describe, expect, it } from 'vitest';
import { ErrorCodeEnum, ProblemDetailsSchema } from '../src/errors.js';

describe('contracts errors', () => {
  it('validates canonical ErrorCode and ProblemDetails', () => {
    expect(ErrorCodeEnum.options).toContain('RX_QUANTITY_EXCEEDED');
    expect(ErrorCodeEnum.options).toContain('BIO_LIVENESS_FAILED');
    const sample = ProblemDetailsSchema.parse({
      type: 'https://docs.smarthealth.app/errors/RX_QUANTITY_EXCEEDED',
      title: 'Requested quantity exceeds remaining quantity',
      status: 409,
      code: 'RX_QUANTITY_EXCEEDED',
      detail: 'Item 2 has 10 tablet(s) remaining; 20 requested.',
      instance: '/v1/pharmacy/prescriptions/00000000-0000-4000-8000-000000000001/dispensations',
      request_id: '5b0d7f3e-6a39-4b8b-9d9c-1a2b3c4d5e6f',
    });
    expect(sample.code).toBe('RX_QUANTITY_EXCEEDED');
  });
});
