import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { readClipboardText } from './clipboard';

vi.mock('@capacitor/clipboard', () => ({
  Clipboard: {
    read: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe('readClipboardText', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('lê texto com sucesso via @capacitor/clipboard', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Clipboard.read).mockResolvedValue({ value: 'https://vm.tiktok.com/ZM12345/', type: 'text/plain' });

    const result = await readClipboardText();
    expect(result.success).toBe(true);
    expect(result.text).toBe('https://vm.tiktok.com/ZM12345/');
  });

  it('retorna erro empty se o clipboard nativo estiver vazio', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Clipboard.read).mockResolvedValue({ value: '', type: 'text/plain' });

    const result = await readClipboardText();
    expect(result.success).toBe(false);
    expect(result.error).toBe('empty');
  });

  it('faz fallback para navigator.clipboard se Capacitor falhar no browser', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Clipboard.read).mockRejectedValue(new Error('Capacitor unavailable on web'));

    const mockReadText = vi.fn().mockResolvedValue('https://www.instagram.com/p/C-12345/');
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await readClipboardText();
    expect(result.success).toBe(true);
    expect(result.text).toBe('https://www.instagram.com/p/C-12345/');
  });

  it('retorna erro permission_denied se leitura for rejeitada', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Clipboard.read).mockRejectedValue(new Error('Capacitor error'));

    const mockReadText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await readClipboardText();
    expect(result.success).toBe(false);
    expect(result.error).toBe('permission_denied');
  });
});
