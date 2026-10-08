import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '@/services/logging/logger';

const log = createLogger('clipboard');

export interface ClipboardReadResult {
  text: string;
  success: boolean;
  error?: 'empty' | 'permission_denied' | 'unsupported';
}

/**
 * Reads plain text from the system clipboard.
 * Prioritizes @capacitor/clipboard on native Android/iOS (bypassing WebView permission restrictions),
 * with a fallback to navigator.clipboard.readText() in browser environments.
 */
export async function readClipboardText(): Promise<ClipboardReadResult> {
  // 1. Try Capacitor native clipboard first
  try {
    const result = await Clipboard.read();
    const value = typeof result?.value === 'string' ? result.value.trim() : '';
    if (value) {
      return { text: value, success: true };
    }
    if (Capacitor.isNativePlatform()) {
      return { text: '', success: false, error: 'empty' };
    }
  } catch (err) {
    log.warn('Capacitor Clipboard.read failed', err);
    if (Capacitor.isNativePlatform()) {
      return { text: '', success: false, error: 'permission_denied' };
    }
  }

  // 2. Fallback to web navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = (text || '').trim();
      if (trimmed) {
        return { text: trimmed, success: true };
      }
      return { text: '', success: false, error: 'empty' };
    } catch (err) {
      log.warn('navigator.clipboard.readText failed', err);
      return { text: '', success: false, error: 'permission_denied' };
    }
  }

  return { text: '', success: false, error: 'unsupported' };
}
