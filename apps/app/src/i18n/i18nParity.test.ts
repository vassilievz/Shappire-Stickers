import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from './translations';

type Dict = Record<string, unknown>;

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') {
    return [prefix];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const keys: string[] = [];
  for (const [key, child] of Object.entries(value as Dict)) {
    keys.push(...flattenKeys(child, prefix === '' ? key : `${prefix}.${key}`));
  }
  return keys;
}

const enKeys = flattenKeys(TRANSLATIONS.en).sort();

describe('locale parity', () => {
  const locales = Object.keys(TRANSLATIONS) as Array<keyof typeof TRANSLATIONS>;

  it('has at least two locales including English', () => {
    expect(locales.length).toBeGreaterThanOrEqual(2);
    expect(locales).toContain('en');
  });

  it.each(locales)('%s has exactly the same keys as en', (locale) => {
    const localeKeys = flattenKeys(TRANSLATIONS[locale]).sort();
    const missing = enKeys.filter((key) => !localeKeys.includes(key));
    const extra = localeKeys.filter((key) => !enKeys.includes(key));
    expect(missing, `missing keys in ${locale}`).toEqual([]);
    expect(extra, `unknown keys in ${locale}`).toEqual([]);
  });

  it.each(locales)('%s has no empty values', (locale) => {
    const empty = flattenKeys(TRANSLATIONS[locale]).filter((key) => {
      const parts = key.split('.');
      let current: unknown = TRANSLATIONS[locale];
      for (const part of parts) {
        current = (current as Dict)[part];
      }
      return typeof current === 'string' && current.trim() === '';
    });
    expect(empty, `empty values in ${locale}`).toEqual([]);
  });
});
