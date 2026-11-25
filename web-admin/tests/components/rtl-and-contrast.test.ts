import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useRxBuilderStore } from '../../stores/rx-builder.store';

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('RTL logical classes, zero-hex, and memory-only PHI store', () => {
  it('uses only logical Tailwind spacing/alignment classes across app/ and components/', () => {
    const root = resolve(process.cwd());
    const files = [...collectTsFiles(join(root, 'app')), ...collectTsFiles(join(root, 'components'))];
    const forbidden = /\b(ml|mr|pl|pr|left|right|text-left|text-right)-\S*/;
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (forbidden.test(content)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it('stores Rx drafts strictly in sessionStorage (never localStorage) and purges completely on clearAllDrafts()', () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    const store = useRxBuilderStore.getState();
    store.addItem('pat-1', {
      client_key: 'item-1',
      drug_id: '00000000-0000-0000-0000-000000000009',
      brand_name: 'Amoxil',
      generic_name: 'Amoxicillin',
      strength: '500mg',
      dosage_form: 'capsule',
      base_unit: 'capsule',
      is_controlled: false,
      dose: '500mg',
      route: 'oral',
      frequency: 'three_times_daily',
      frequency_interval_hours: null,
      duration_days: 7,
      quantity: 21,
      instructions: 'After meals',
      substitution_allowed: true,
    });
    const localDump =
      typeof window !== 'undefined' && window.localStorage
        ? JSON.stringify(window.localStorage)
        : '';
    expect(localDump).not.toContain('Amoxil');
    expect(localDump).not.toContain('pat-1');
    expect(window.sessionStorage.getItem('sh-rx-builder-drafts')).toContain('Amoxil');

    store.clearAllDrafts();
    expect(Object.keys(useRxBuilderStore.getState().drafts)).toHaveLength(0);
    expect(window.sessionStorage.getItem('sh-rx-builder-drafts') ?? '').not.toContain('Amoxil');
  });
});
