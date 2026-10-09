import { SCHEMA_VERSION } from '@/config/storage';
import { readJson, writeJson } from './jsonStore';
import { settingsPath } from './paths';

export type ThemePreference = 'dark' | 'light' | 'system';
export type LanguagePreference = 'en' | 'pt-BR' | 'es' | 'de' | 'it' | 'hi';


export interface AppSettings {
  theme: ThemePreference;
  language: LanguagePreference;
  
  defaultPackId: string | null;
  
  showTransparencyGrid: boolean;
  
  confirmDestructiveActions: boolean;
  
  performanceDiagnostics: boolean;
  
  lastRoute: string;

  /** Nome de exibição do autor mostrado ABAIXO da figurinha na tela de detalhe. Não é gravado na imagem. */
  authorDisplayName: string;

  /** Modelo de IA padrão selecionado pelo usuário para melhoria de imagens. */
  defaultAiModelId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultPackId: null,
  showTransparencyGrid: true,
  confirmDestructiveActions: true,
  performanceDiagnostics: false,
  lastRoute: '/inicio',
  authorDisplayName: 'Vassiliev',
  defaultAiModelId: 'realesr-anime-v3-4x',
};

interface SettingsDocument {
  schemaVersion: number;
  settings: AppSettings;
}

const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  'en',
  'pt-BR',
  'es',
  'de',
  'it',
  'hi',
]);

function sanitize(value: Partial<AppSettings> | null | undefined): AppSettings {
  if (!value) return { ...DEFAULT_SETTINGS };
  const theme: ThemePreference =
    value.theme === 'light' || value.theme === 'system' || value.theme === 'dark'
      ? value.theme
      : DEFAULT_SETTINGS.theme;
  const language: LanguagePreference =
    value.language && SUPPORTED_LANGUAGES.has(value.language)
      ? (value.language as LanguagePreference)
      : DEFAULT_SETTINGS.language;
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
    authorDisplayName:
      typeof value.authorDisplayName === 'string'
        ? value.authorDisplayName.slice(0, 24).trim()
        : (value as { authorSignatureName?: unknown }).authorSignatureName &&
            typeof (value as { authorSignatureName?: unknown }).authorSignatureName === 'string'
          ? String((value as { authorSignatureName?: unknown }).authorSignatureName)
              .slice(0, 24)
              .trim()
          : DEFAULT_SETTINGS.authorDisplayName,
    defaultAiModelId:
      typeof value.defaultAiModelId === 'string'
        ? value.defaultAiModelId
        : DEFAULT_SETTINGS.defaultAiModelId,
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
