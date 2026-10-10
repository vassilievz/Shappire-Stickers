import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDecorationLoadState,
  preloadDecorationImage,
  resetDecorationImageCache,
} from './decorationImageCache';

describe('decorationImageCache', () => {
  afterEach(() => {
    resetDecorationImageCache();
    vi.restoreAllMocks();
  });

  it('deduplica pré-carregamentos simultâneos', async () => {
    let constructed = 0;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decoding = 'async';
      set src(_value: string) {
        constructed += 1;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage as unknown as typeof Image);

    const url = 'https://example.com/decoration.png';
    await Promise.all([preloadDecorationImage(url), preloadDecorationImage(url)]);

    expect(constructed).toBe(1);
    expect(getDecorationLoadState(url)).toBe('loaded');
  });
});
