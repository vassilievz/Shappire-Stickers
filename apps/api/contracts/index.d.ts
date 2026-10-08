/**
 * Contratos compartilhados entre o app Shappire Stickers (apps/app) e a API
 * Shappire (apps/api). Fonte única de verdade para limites, formatos, rotas e
 * códigos de erro — evita que os dois lados driftam.
 */

export const USERNAME_MIN_LENGTH: number;
export const USERNAME_MAX_LENGTH: number;
export const USERNAME_PATTERN: RegExp;

/** Remove espaços, acentos e converte para minúsculas (mesma regra do app). */
export function normalizeUsername(value: string): string;

export const MAX_DISPLAY_NAME_LENGTH: number;
export const MAX_BIO_LENGTH: number;

export interface ProfileImageMaxBytes {
  readonly avatar: number;
  readonly banner: number;
}
export const PROFILE_IMAGE_MAX_BYTES: ProfileImageMaxBytes;

export const PROFILE_IMAGE_MIME_TYPES: readonly string[];

export interface ApiRoutes {
  readonly health: '/health';
  readonly profile: '/api/profile';
  readonly avatar: '/api/profile/avatar';
  readonly banner: '/api/profile/banner';
}
export const API_ROUTES: ApiRoutes;

export const API_ERROR_CODES: readonly string[];

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'USERNAME_TAKEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR';

/** Corpo de erro padrão devolvido pela API. */
export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}

/** Metadados de imagem hospedada no V0X persistidos no MongoDB. */
export interface HostedImageMeta {
  fileId: string;
  url: string;
  mimeType: string;
}
