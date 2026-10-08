import { describe, expect, it } from 'vitest';
import {
  deriveProfileStats,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_IMAGE_URL_LENGTH,
  normalizeUsername,
  sanitizeProfileImage,
  validateBio,
  validateDisplayName,
  validateImageUrl,
  validateUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from './profile';
import type { StickerPack } from './stickerPack';

function packWith(stickerCount: number): StickerPack {
  return {
    stickers: Array.from({ length: stickerCount }, (_, index) => ({
      id: `sticker-${index}`,
    })),
  } as unknown as StickerPack;
}

describe('normalizeUsername', () => {
  it('normaliza para minúsculas sem espaços', () => {
    expect(normalizeUsername('  Vassilievz  ')).toBe('vassilievz');
    expect(normalizeUsername('VASSILIEVZ')).toBe('vassilievz');
  });

  it('remove acentos (case-insensitive entre @Vassilievz e @vassilievz)', () => {
    expect(normalizeUsername('Vassilievz')).toBe('vassilievz');
    expect(normalizeUsername('josé')).toBe('jose');
    expect(normalizeUsername('ÃO')).toBe('ao');
  });
});

describe('validateUsername', () => {
  it('aceita usernames válidos nos limites', () => {
    expect(validateUsername('vassilievz')).toEqual({ valid: true, username: 'vassilievz' });
    expect(validateUsername('user_01')).toEqual({ valid: true, username: 'user_01' });
    expect(validateUsername('a'.repeat(USERNAME_MIN_LENGTH))).toEqual({
      valid: true,
      username: 'a'.repeat(USERNAME_MIN_LENGTH),
    });
    expect(validateUsername('a'.repeat(USERNAME_MAX_LENGTH))).toEqual({
      valid: true,
      username: 'a'.repeat(USERNAME_MAX_LENGTH),
    });
  });

  it('normaliza antes de validar', () => {
    expect(validateUsername('  Gabriel ')).toEqual({ valid: true, username: 'gabriel' });
    expect(validateUsername('Usér_Namé')).toEqual({ valid: true, username: 'user_name' });
  });

  it('rejeita vazio', () => {
    expect(validateUsername('')).toEqual({ valid: false, username: '', issue: 'empty' });
    expect(validateUsername('   ')).toEqual({ valid: false, username: '', issue: 'empty' });
  });

  it('rejeita fora do intervalo de tamanho', () => {
    expect(validateUsername('ab')).toEqual({ valid: false, username: 'ab', issue: 'length' });
    expect(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1))).toMatchObject({
      valid: false,
      issue: 'length',
    });
  });

  it('rejeita caracteres não permitidos', () => {
    expect(validateUsername('user-name')).toMatchObject({ valid: false, issue: 'chars' });
    expect(validateUsername('user name')).toMatchObject({ valid: false, issue: 'chars' });
    expect(validateUsername('user@name')).toMatchObject({ valid: false, issue: 'chars' });
    expect(validateUsername('😀sticker')).toMatchObject({ valid: false, issue: 'chars' });
  });
});

describe('validateImageUrl', () => {
  it('aceita apenas http e https', () => {
    expect(validateImageUrl('https://example.com/img.png')).toBe(true);
    expect(validateImageUrl('http://example.com/img.png')).toBe(true);
    expect(validateImageUrl('  https://example.com/img.png  ')).toBe(true);
  });

  it('rejeita esquemas perigosos ou inválidos', () => {
    expect(validateImageUrl('javascript:alert(1)')).toBe(false);
    expect(validateImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(validateImageUrl('ftp://example.com/img.png')).toBe(false);
    expect(validateImageUrl('example.com/img.png')).toBe(false);
    // O conteúdo do caminho não é inspecionado: a URL é usada apenas como
    // `img src`, nunca executada — a validação de esquema basta (Parte 8).
    expect(validateImageUrl('https://example.com/${alert(1)}')).toBe(true);
  });

  it('rejeita vazio e comprimento excessivo', () => {
    expect(validateImageUrl('')).toBe(false);
    expect(validateImageUrl('   ')).toBe(false);
    const exactlyMax = `https://example.com/${'a'.repeat(MAX_IMAGE_URL_LENGTH - 'https://example.com/'.length)}`;
    expect(exactlyMax.length).toBe(MAX_IMAGE_URL_LENGTH);
    expect(validateImageUrl(exactlyMax)).toBe(true);
    expect(validateImageUrl(`${exactlyMax}a`)).toBe(false);
  });
});

describe('validateBio', () => {
  it('limita a bio ao máximo de caracteres', () => {
    expect(validateBio('')).toBe(true);
    expect(validateBio('a'.repeat(MAX_BIO_LENGTH))).toBe(true);
    expect(validateBio('a'.repeat(MAX_BIO_LENGTH + 1))).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('exige nome não vazio dentro do limite', () => {
    expect(validateDisplayName('Gabriel')).toBe(true);
    expect(validateDisplayName('   Gabriel   ')).toBe(true);
    expect(validateDisplayName('a'.repeat(MAX_DISPLAY_NAME_LENGTH))).toBe(true);
    expect(validateDisplayName('   ')).toBe(false);
    expect(validateDisplayName('')).toBe(false);
    expect(validateDisplayName('a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toBe(false);
  });
});

describe('sanitizeProfileImage', () => {
  it('aceita metadados válidos vindos da API ou do cache', () => {
    expect(
      sanitizeProfileImage({
        fileId: 'file-avatar-1',
        url: 'https://cdn.example.com/me.png',
        mimeType: 'image/png',
      }),
    ).toEqual({
      fileId: 'file-avatar-1',
      url: 'https://cdn.example.com/me.png',
      mimeType: 'image/png',
    });
    expect(
      sanitizeProfileImage({
        fileId: 'v0x-abc',
        url: 'https://cdn.v0x.lol/banner.webp',
        mimeType: 'image/webp',
      }),
    ).toEqual({
      fileId: 'v0x-abc',
      url: 'https://cdn.v0x.lol/banner.webp',
      mimeType: 'image/webp',
    });
  });

  it('descarta valores inválidos', () => {
    expect(sanitizeProfileImage(null)).toBeNull();
    expect(sanitizeProfileImage('https://example.com/a.png')).toBeNull();
    expect(sanitizeProfileImage(42)).toBeNull();
    // Sem fileId (ou vazio) — metadado incompleto.
    expect(sanitizeProfileImage({ url: 'https://example.com/a.png', mimeType: 'image/png' })).toBeNull();
    expect(
      sanitizeProfileImage({ fileId: '', url: 'https://example.com/a.png', mimeType: 'image/png' }),
    ).toBeNull();
    // URL ausente ou com esquema perigoso.
    expect(sanitizeProfileImage({ fileId: 'file-1', mimeType: 'image/png' })).toBeNull();
    expect(
      sanitizeProfileImage({ fileId: 'file-1', url: 'javascript:alert(1)', mimeType: 'image/png' }),
    ).toBeNull();
    // MIME fora da allowlist compartilhada (§15).
    expect(
      sanitizeProfileImage({ fileId: 'file-1', url: 'https://example.com/a.png', mimeType: 'image/bmp' }),
    ).toBeNull();
    expect(
      sanitizeProfileImage({ fileId: 'file-1', url: 'https://example.com/a.png' }),
    ).toBeNull();
  });
});

describe('deriveProfileStats', () => {
  it('retorna zeros sem pacotes', () => {
    expect(deriveProfileStats([])).toEqual({ packs: 0, stickers: 0 });
  });

  it('soma pacotes e figurinhas a partir da biblioteca local', () => {
    const stats = deriveProfileStats([packWith(3), packWith(5), packWith(30)]);
    expect(stats).toEqual({ packs: 3, stickers: 38 });
  });
});
