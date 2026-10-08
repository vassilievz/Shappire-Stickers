import { describe, expect, it } from 'vitest';
import { SUPPORTED_PLATFORMS } from './platforms';

describe('SUPPORTED_PLATFORMS', () => {
  it('exclui o YouTube completamente de IDs, nomes e extractors', () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      expect(platform.id.toLowerCase()).not.toContain('youtube');
      expect(platform.name.toLowerCase()).not.toContain('youtube');
      for (const extractor of platform.groupedExtractors) {
        expect(extractor.toLowerCase()).not.toContain('youtube');
        expect(extractor.toLowerCase()).not.toContain('youtu.be');
      }
    }
  });

  it('não possui duplicatas de id ou de nome', () => {
    const ids = SUPPORTED_PLATFORMS.map((p) => p.id);
    const names = SUPPORTED_PLATFORMS.map((p) => p.name);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('mantém todas as plataformas sociais primárias requeridas', () => {
    const required = [
      'TikTok',
      'Instagram',
      'Twitter / X',
      'Facebook',
      'Threads',
      'Pinterest',
      'Reddit',
      'SoundCloud',
      'Vimeo',
      'Dailymotion',
      'Twitch',
    ];

    const platformNames = SUPPORTED_PLATFORMS.map((p) => p.name);
    for (const name of required) {
      expect(platformNames).toContain(name);
    }
  });

  it('possui ao menos 45 plataformas curadas agrupando variantes', () => {
    expect(SUPPORTED_PLATFORMS.length).toBeGreaterThanOrEqual(45);
    for (const platform of SUPPORTED_PLATFORMS) {
      expect(platform.groupedExtractors.length).toBeGreaterThan(0);
      expect(platform.exampleDomain).toBeTruthy();
    }
  });
});
