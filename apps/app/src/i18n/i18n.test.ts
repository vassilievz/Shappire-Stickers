import { describe, expect, it } from 'vitest';
import { t } from './index';
import { TRANSLATIONS } from './translations';
import type { LanguagePreference } from '@/services/storage/settingsRepository';

describe('i18n translations', () => {
  const languages: LanguagePreference[] = ['en', 'pt-BR', 'es', 'de', 'it', 'hi'];

  it('contains dictionary for all supported languages', () => {
    for (const lang of languages) {
      expect(TRANSLATIONS[lang]).toBeDefined();
      expect(TRANSLATIONS[lang].nav.home).toBeTruthy();
    }
  });

  it('translates home nav link correctly in each language', () => {
    expect(t('nav.home', undefined, 'en')).toBe('Home');
    expect(t('nav.home', undefined, 'pt-BR')).toBe('Início');
    expect(t('nav.home', undefined, 'es')).toBe('Inicio');
    expect(t('nav.home', undefined, 'de')).toBe('Start');
    expect(t('nav.home', undefined, 'it')).toBe('Home');
    expect(t('nav.home', undefined, 'hi')).toBe('होम');
  });

  it('translates community and profile nav links correctly in each language', () => {
    expect(t('nav.community', undefined, 'en')).toBe('Community');
    expect(t('nav.community', undefined, 'pt-BR')).toBe('Comunidade');
    expect(t('nav.profile', undefined, 'en')).toBe('Profile');
    expect(t('nav.profile', undefined, 'pt-BR')).toBe('Perfil');
    expect(t('nav.profile', undefined, 'de')).toBe('Profil');
    expect(t('nav.profile', undefined, 'it')).toBe('Profilo');
    expect(t('nav.profile', undefined, 'hi')).toBe('प्रोफ़ाइल');
  });

  it('interpolates parameters correctly', () => {
    expect(t('home.stickersCount', { count: 5 }, 'en')).toBe('5 of 30 stickers');
    expect(t('home.stickersCount', { count: 5 }, 'pt-BR')).toBe('5 de 30 figurinhas');
    expect(t('home.stickersCount', { count: 5 }, 'es')).toBe('5 de 30 stickers');
    expect(t('home.stickersCount', { count: 5 }, 'de')).toBe('5 von 30 Stickern');
    expect(t('home.stickersCount', { count: 5 }, 'it')).toBe('5 di 30 sticker');
    expect(t('home.stickersCount', { count: 5 }, 'hi')).toBe('5 / 30 स्टिकर');
  });

  it('falls back to English when key is missing in other languages', () => {
    expect(t('some.missing.key', undefined, 'es')).toBe('some.missing.key');
  });
});
