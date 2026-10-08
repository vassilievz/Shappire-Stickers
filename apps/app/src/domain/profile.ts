import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  normalizeUsername,
} from '@shappire/contracts';
import type { StickerPack } from './stickerPack';

export type ProfileImageSlot = 'avatar' | 'banner';

/**
 * Imagem hospedada no V0X via API Shappire: o MongoDB guarda somente estes
 * metadados — nenhum binário no app nem no banco (§13).
 */
export interface ProfileImage {
  fileId: string;
  url: string;
  mimeType: string;
}

export interface ProfileStats {
  packs: number;
  stickers: number;
}

// Limites e normalização compartilhados com a API via @shappire/contracts —
// fonte única de verdade para os dois lados não driftarem.
export {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  normalizeUsername,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_BIO_LENGTH,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
};

export const MAX_IMAGE_URL_LENGTH = 2048;

export type UsernameIssue = 'empty' | 'length' | 'chars';

export interface UsernameValidation {
  valid: boolean;
  username: string;
  issue?: UsernameIssue;
}

export function validateUsername(raw: string): UsernameValidation {
  const username = normalizeUsername(raw);
  if (username === '') {
    return { valid: false, username, issue: 'empty' };
  }
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return { valid: false, username, issue: 'length' };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { valid: false, username, issue: 'chars' };
  }
  return { valid: true, username };
}

/**
 * Aceita apenas URLs http(s) — usada para validar a URL vinda da API/cache
 * antes de virar `img src`. Nada é baixado para validar.
 */
export function validateImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateBio(raw: string): boolean {
  return raw.length <= MAX_BIO_LENGTH;
}

export function validateDisplayName(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed !== '' && trimmed.length <= MAX_DISPLAY_NAME_LENGTH;
}

/**
 * Estatísticas reais derivadas dos dados locais (biblioteca de pacotes). Nunca
 * são persistidas no servidor — o cliente não pode forjar métricas porque não
 * existem como campo gravável.
 */
export function deriveProfileStats(packs: readonly StickerPack[]): ProfileStats {
  return {
    packs: packs.length,
    stickers: packs.reduce((total, pack) => total + pack.stickers.length, 0),
  };
}

/**
 * Sanitiza metadados de imagem vindos da API ou do cache local: fileId não
 * vazio, URL http(s) válida e MIME da allowlist compartilhada. Qualquer coisa
 * fora disso vira null — cache/resposta corrompida nunca quebra a UI.
 */
export function sanitizeProfileImage(value: unknown): ProfileImage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { fileId?: unknown; url?: unknown; mimeType?: unknown };
  if (typeof candidate.fileId !== 'string' || candidate.fileId === '') {
    return null;
  }
  if (typeof candidate.url !== 'string' || !validateImageUrl(candidate.url)) {
    return null;
  }
  if (typeof candidate.mimeType !== 'string' || !PROFILE_IMAGE_MIME_TYPES.includes(candidate.mimeType)) {
    return null;
  }
  return { fileId: candidate.fileId, url: candidate.url, mimeType: candidate.mimeType };
}
