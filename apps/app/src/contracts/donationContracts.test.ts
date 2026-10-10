import { describe, expect, it } from 'vitest';
import { DONATION_AMOUNTS, DONATION_MIN_AMOUNT, DONATION_MAX_AMOUNT } from '@shappire/contracts';

describe('@shappire/contracts doações', () => {
  it('mínimo compartilhado é R$ 5', () => {
    expect(DONATION_MIN_AMOUNT).toBe(5);
    expect(DONATION_AMOUNTS[0]).toBe(5);
    expect(DONATION_AMOUNTS.every((n) => n >= DONATION_MIN_AMOUNT)).toBe(true);
    expect(DONATION_MAX_AMOUNT).toBeGreaterThan(DONATION_MIN_AMOUNT);
  });
});
