import { useCallback } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import type { LanguagePreference } from '@/services/storage/settingsRepository';
import { TRANSLATIONS } from './translations';

export function getCurrentLanguage(): LanguagePreference {
  try {
    return useSettingsStore.getState().settings.language ?? 'en';
  } catch {
    return 'en';
  }
}

export function t(
  path: string,
  params?: Record<string, string | number>,
  overrideLang?: LanguagePreference,
): string {
  const lang = overrideLang ?? getCurrentLanguage();
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const fallbackDict = TRANSLATIONS.en;

  const parts = path.split('.');
  let current: unknown = dict;
  let fallbackCurrent: unknown = fallbackDict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
    }

    if (fallbackCurrent && typeof fallbackCurrent === 'object' && part in fallbackCurrent) {
      fallbackCurrent = (fallbackCurrent as Record<string, unknown>)[part];
    } else {
      fallbackCurrent = undefined;
    }
  }

  let text = typeof current === 'string' ? current : typeof fallbackCurrent === 'string' ? fallbackCurrent : path;

  if (params) {
    for (const [key, val] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }
  }

  return text;
}

export function useTranslation() {
  const language = useSettingsStore((state) => state.settings.language);
  const update = useSettingsStore((state) => state.update);

  const translate = useCallback(
    (path: string, params?: Record<string, string | number>): string => t(path, params, language),
    [language],
  );

  const setLanguage = async (newLang: LanguagePreference) => {
    await update({ language: newLang });
  };

  return {
    t: translate,
    language,
    setLanguage,
  };
}
