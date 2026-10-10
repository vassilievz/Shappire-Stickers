import { describe, expect, it } from 'vitest';
import { compareSemver, isVersionLessThan } from './semver';

describe('semver', () => {
  it('compara major.minor.patch', () => {
    expect(compareSemver('0.2.1', '0.2.2')).toBe(-1);
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemver('0.2.2', '0.2.2')).toBe(0);
  });

  it('detecta versão menor', () => {
    expect(isVersionLessThan('0.2.1', '0.2.2')).toBe(true);
    expect(isVersionLessThan('0.3.0', '0.2.9')).toBe(false);
  });
});
