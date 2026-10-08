import { describe, expect, it } from 'vitest';
import { AppError, friendlyMessage, toAppError } from './errors';
import { t } from '@/i18n';
import { useSettingsStore } from '@/state/settingsStore';
import type { LanguagePreference } from '@/services/storage/settingsRepository';

const languages: LanguagePreference[] = ['en', 'pt-BR', 'es', 'de', 'it', 'hi'];

function setLanguage(lang: LanguagePreference) {
  useSettingsStore.setState({
    settings: { ...useSettingsStore.getState().settings, language: lang },
  });
}

describe('AppError', () => {
  it('identifica instâncias de AppError', () => {
    const error = new AppError('INVALID_INPUT', 'Dados inválidos.');
    expect(AppError.is(error)).toBe(true);
    expect(AppError.is(new Error('comum'))).toBe(false);
    expect(AppError.is('string')).toBe(false);
  });

  it('reaproveita AppError existente em toAppError', () => {
    const error = new AppError('NETWORK_ERROR', 'sem rede');
    expect(toAppError(error)).toBe(error);
  });

  it('envolve Error genérico com código de fallback', () => {
    const wrapped = toAppError(new Error('boom'), 'STORAGE_READ_FAILED');
    expect(wrapped.code).toBe('STORAGE_READ_FAILED');
    expect(wrapped.message).toBe('boom');
  });

  it('envolve valor não-Error com UNKNOWN', () => {
    const wrapped = toAppError(42);
    expect(wrapped.code).toBe('UNKNOWN');
  });
});

describe('friendlyMessage', () => {
  it('localiza os códigos do fluxo de perfil em todos os idiomas', () => {
    const codes = ['UNSUPPORTED_FORMAT', 'IMAGE_TOO_LARGE', 'UPLOAD_FAILED', 'NETWORK_ERROR'] as const;

    for (const lang of languages) {
      setLanguage(lang);
      for (const code of codes) {
        const error = new AppError(code, 'mensagem bruta');
        expect(friendlyMessage(error)).toBe(t(`errors.${code}`, undefined, lang));
      }
    }
  });

  it('prefere a mensagem localizada à mensagem bruta do AppError', () => {
    setLanguage('pt-BR');
    const error = new AppError('AUTH_FAILED', 'mensagem bruta do Firebase');
    expect(friendlyMessage(error)).toBe(t('errors.AUTH_FAILED', undefined, 'pt-BR'));
    expect(friendlyMessage(error)).not.toBe('mensagem bruta do Firebase');
  });

  it('envolve erros desconhecidos com mensagem amigável', () => {
    setLanguage('en');
    expect(friendlyMessage('boom')).toBe(t('errors.UNKNOWN', undefined, 'en'));
    expect(friendlyMessage(new Error('inesperado'))).toBe(t('errors.UNKNOWN', undefined, 'en'));
  });
});
