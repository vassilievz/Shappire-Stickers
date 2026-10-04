import { create } from 'zustand';
import { setDiagnosticsEnabled } from '@/services/diagnostics/perf';
import { createLogger } from '@/services/logging/logger';
import { friendlyMessage } from '@/shared/errors';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from '@/services/storage/settingsRepository';
import { showToast } from './toastStore';

const log = createLogger('settings');

export type SettingsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SettingsState {
  settings: AppSettings;
  status: SettingsStatus;
  
  hydrate: () => Promise<void>;
  
  update: (patch: Partial<AppSettings>) => Promise<void>;
}


export function applyTheme(theme: AppSettings['theme']): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  root.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#08090b' : '#f6f7f9');
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  status: 'idle',

  hydrate: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      const settings = await loadSettings();
      applyTheme(settings.theme);
      setDiagnosticsEnabled(settings.performanceDiagnostics);
      set({ settings, status: 'ready' });
    } catch (error) {
      log.warn('Falha ao carregar configurações', error);
      applyTheme(DEFAULT_SETTINGS.theme);
      set({ settings: { ...DEFAULT_SETTINGS }, status: 'error' });
    }
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if ('theme' in patch) applyTheme(next.theme);
    if ('performanceDiagnostics' in patch) setDiagnosticsEnabled(next.performanceDiagnostics);
    try {
      await saveSettings(next);
    } catch (error) {
      log.warn('Falha ao gravar configurações', error);
      showToast(friendlyMessage(error), 'error');
    }
  },
}));
