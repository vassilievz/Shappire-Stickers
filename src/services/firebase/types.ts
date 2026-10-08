/**
 * Tipos e contratos da camada Firebase do Shappire Stickers.
 */

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AnalyticsEventName =
  | 'app_open'
  | 'sticker_created'
  | 'sticker_exported'
  | 'pack_created'
  | 'pack_exported'
  | 'image_imported'
  | 'zip_imported'
  | 'whatsapp_export'
  | 'login_started'
  | 'login_completed'
  | 'logout';

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;
