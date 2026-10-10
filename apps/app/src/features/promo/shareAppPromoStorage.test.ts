import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissSharePromoPermanent,
  shouldShowSharePromo,
  snoozeSharePromo,
} from './shareAppPromoStorage';

describe('shareAppPromoStorage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('mostra o promo por padrão', () => {
    expect(shouldShowSharePromo()).toBe(true);
  });

  it('respeita snooze', () => {
    snoozeSharePromo();
    expect(shouldShowSharePromo()).toBe(false);
  });

  it('respeita dismiss permanente', () => {
    dismissSharePromoPermanent();
    expect(shouldShowSharePromo()).toBe(false);
  });
});
