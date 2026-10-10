import { afterEach, describe, expect, it } from 'vitest';
import {
  getBodyScrollLockCountForTests,
  lockBodyScroll,
  resetBodyScrollLockForTests,
  unlockBodyScroll,
} from './bodyScrollLock';

describe('bodyScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    resetBodyScrollLockForTests();
  });

  it('locks body on first lock and restores after last unlock', () => {
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'pan-y';

    lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.touchAction).toBe('pan-y');
    expect(getBodyScrollLockCountForTests()).toBe(0);
  });

  it('keeps body locked until all nested overlays unlock', () => {
    lockBodyScroll();
    lockBodyScroll();
    expect(getBodyScrollLockCountForTests()).toBe(2);

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('');
    expect(getBodyScrollLockCountForTests()).toBe(0);
  });

  it('does not leave touch-action none after sheet then modal sequence', () => {
    lockBodyScroll();
    lockBodyScroll();
    unlockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.touchAction).toBe('');
  });
});
