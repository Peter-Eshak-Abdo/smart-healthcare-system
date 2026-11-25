import { describe, expect, it } from 'vitest';
import arMessages from '../../i18n/messages/ar.json';
import enMessages from '../../i18n/messages/en.json';

describe('i18n messages', () => {
  it('has matching app keys in ar and en', () => {
    expect(arMessages.app.name).toBe('سمارت هيلث');
    expect(enMessages.app.name).toBe('SmartHealth');
  });
});
