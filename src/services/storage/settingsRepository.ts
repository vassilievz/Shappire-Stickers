import { SCHEMA_VERSION } from '@/config/storage';
import { readJson, writeJson } from './jsonStore';
import { settingsPath } from './paths';

export type ThemePreference = 'dark' | 'light' | 'system';
export type LanguagePreference = 'en' | 'pt-BR';


export interface AppSettings {
  theme: ThemePreference;
  language: LanguagePreference;
  
  defaultPackId: string | null;
  
  showTransparencyGrid: boolean;
  
  confirmDestructiveActions: boolean;
  
  performanceDiagnostics: boolean;
  
  lastRoute: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultPackId: null,
  showTransparencyGrid: true,
  confirmDestructiveActions: true,
  performanceDiagnostics: false,
  lastRoute: '/inicio',
};

interface SettingsDocument {
  schemaVersion: number;
  settings: AppSettings;
}

function sanitize(value: Partial<AppSettings> | null | undefined): AppSettings {
  if (!value) return { ...DEFAULT_SETTINGS };
  const theme: ThemePreference =
    value.theme === 'light' || value.theme === 'system' || value.theme === 'dark'
      ? value.theme
      : DEFAULT_SETTINGS.theme;
  const language: LanguagePreference =
    value.language === 'pt-BR' || value.language === 'en' ? value.language : DEFAULT_SETTINGS.language;
  return {
    theme,
    language,
    defaultPackId: typeof value.defaultPackId === 'string' ? value.defaultPackId : null,
    showTransparencyGrid:
      typeof value.showTransparencyGrid === 'boolean'
        ? value.showTransparencyGrid
        : DEFAULT_SETTINGS.showTransparencyGrid,
    confirmDestructiveActions:
      typeof value.confirmDestructiveActions === 'boolean'
        ? value.confirmDestructiveActions
        : DEFAULT_SETTINGS.confirmDestructiveActions,
    performanceDiagnostics:
      typeof value.performanceDiagnostics === 'boolean'
        ? value.performanceDiagnostics
        : DEFAULT_SETTINGS.performanceDiagnostics,
    lastRoute: typeof value.lastRoute === 'string' ? value.lastRoute : DEFAULT_SETTINGS.lastRoute,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const { data } = await readJson<SettingsDocument>(settingsPath());
  return sanitize(data?.settings);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const document: SettingsDocument = { schemaVersion: SCHEMA_VERSION, settings };
  await writeJson(settingsPath(), document);
}
