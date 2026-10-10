/**
 * Contratos compartilhados entre o app Shappire Stickers (apps/app) e a API
 * Shappire (apps/api). Fonte única de verdade para limites, formatos, rotas e
 * códigos de erro — evita que os dois lados driftam.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Remove espaços, acentos e converte para minúsculas (mesma regra do app). */
export function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_BIO_LENGTH = 160;

export const PROFILE_IMAGE_MAX_BYTES = Object.freeze({
  avatar: 5 * 1024 * 1024,
  banner: 10 * 1024 * 1024,
});

export const PROFILE_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const INITIAL_SUPPORTER_BADGE = 'initial_supporter';
export const DONATION_AMOUNTS = Object.freeze([5, 10, 20, 50, 100]);
export const DONATION_MIN_AMOUNT = 1;
export const DONATION_MAX_AMOUNT = 5000;

export const API_ROUTES = Object.freeze({
  health: '/health',
  profile: '/api/profile',
  avatar: '/api/profile/avatar',
  banner: '/api/profile/banner',
  donations: '/api/donations',
  myDonations: '/api/donations/me',
});

/**
 * Códigos de erro estáveis devolvidos pela API no formato
 * { "error": "<API_ERROR_CODE>", "message": "<mensagem humana>" }.
 * O app mapeia `error` (enum estável), não `message`.
 */
export const API_ERROR_CODES = Object.freeze([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'PROFILE_NOT_FOUND',
  'USERNAME_TAKEN',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMIT_EXCEEDED',
  'UPLOAD_FAILED',
  'INTERNAL_ERROR',
  'DONATION_NOT_FOUND',
  'PAYMENT_GATEWAY_ERROR',
  'INVALID_AMOUNT',
]);

