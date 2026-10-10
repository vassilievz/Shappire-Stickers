import { API_ROUTES, type ActiveAvatarDecoration, type MonthlyDonorStatus } from '@shappire/contracts';
import { apiRequest, UPLOAD_TIMEOUT_MS } from './client';
import { getFirebaseAuth } from '@/services/firebase/config';
import { useAuthStore } from '@/state/authStore';
import { sanitizeProfileImage, type ProfileImage, type ProfileImageSlot } from '@/domain/profile';
import type { UserProfile } from '@/services/firebase/types';
import { AppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('profile-api');

const FALLBACK_DISPLAY_NAME = 'Usuário Shappire';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeMonthlyDonor(value: unknown): MonthlyDonorStatus | undefined {
  if (!isRecord(value)) return undefined;
  const active = value.active === true;
  const expiresAt = optionalString(value.expiresAt) ?? null;
  const daysRemaining = typeof value.daysRemaining === 'number' ? value.daysRemaining : 0;
  return { active, expiresAt, daysRemaining };
}

function sanitizeAvatarDecoration(value: unknown): ActiveAvatarDecoration | null {
  if (!isRecord(value)) return null;
  const id = optionalString(value.id);
  const url = optionalString(value.url);
  const label = optionalString(value.label);
  if (!id || !url || !label) return null;
  const overlay = isRecord(value.overlay)
    ? {
        scale: typeof value.overlay.scale === 'number' ? value.overlay.scale : 1.18,
        offsetX: typeof value.overlay.offsetX === 'number' ? value.overlay.offsetX : 0,
        offsetY: typeof value.overlay.offsetY === 'number' ? value.overlay.offsetY : 0,
        fit: (value.overlay.fit === 'cover' ? 'cover' : 'contain') as 'contain' | 'cover',
      }
    : undefined;
  return { id, url, label, overlay };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * A API não devolve photoURL (dado do Firebase Auth, não do MongoDB) — o app
 * completa com a foto da conta logada para uso como fallback visual.
 */
function authPhotoUrl(): string | null {
  try {
    return getFirebaseAuth().currentUser?.photoURL ?? null;
  } catch {
    return null;
  }
}

/**
 * Sanitiza o JSON de perfil (resposta da API ou cache local) para UserProfile.
 * Dados inválidos viram valores padrão — nunca estado quebrado na UI.
 */
export function toUserProfile(uid: string, data: unknown): UserProfile | null {
  if (!isRecord(data)) {
    return null;
  }
  return {
    uid: optionalString(data.uid) ?? uid,
    displayName: optionalString(data.displayName) ?? FALLBACK_DISPLAY_NAME,
    email: typeof data.email === 'string' ? data.email : '',
    photoURL: optionalString(data.photoURL) ?? authPhotoUrl(),
    username: optionalString(data.username) ?? null,
    bio: typeof data.bio === 'string' ? data.bio : '',
    avatar: sanitizeProfileImage(data.avatar),
    banner: sanitizeProfileImage(data.banner),
    badges: Array.isArray(data.badges)
      ? data.badges.filter((b): b is string => typeof b === 'string')
      : [],
    avatarDecorationId: optionalString(data.avatarDecorationId) ?? null,
    avatarDecoration: sanitizeAvatarDecoration(data.avatarDecoration),
    monthlyDonor: sanitizeMonthlyDonor(data.monthlyDonor),
    inviteCode: optionalString(data.inviteCode) ?? null,
    publicId: optionalString(data.publicId) ?? null,
    createdAt: optionalString(data.createdAt),
    updatedAt: optionalString(data.updatedAt),
  };
}

function requireProfile(uid: string, body: unknown): UserProfile {
  const profile = toUserProfile(uid, body);
  if (!profile) {
    logger.warn('Resposta de perfil inválida da API.');
    throw new AppError('DATA_CORRUPTED', 'Resposta inválida do servidor de perfil.');
  }
  return profile;
}

function currentUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid || useAuthStore.getState().user?.uid;
  if (!uid) {
    throw new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre novamente para continuar.');
  }
  return uid;
}

/**
 * GET /api/profile. Devolve null quando o perfil ainda não existe no MongoDB
 * (é criado no primeiro PATCH) — não é erro.
 */
export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const uid = currentUid();
    const response = await apiRequest(API_ROUTES.profile);
    return toUserProfile(uid, response.body);
  } catch (error) {
    const details = AppError.is(error) ? error.details : undefined;
    if (AppError.is(error) && error.code === 'NOT_FOUND' && details?.reason === 'PROFILE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

export interface ProfilePatch {
  displayName: string;
  username: string | null;
  bio: string;
  avatar: ProfileImage | null;
  banner: ProfileImage | null;
}

/** PATCH /api/profile — só campos próprios; o servidor deriva o uid do token (§12). */
export async function updateProfile(patch: ProfilePatch): Promise<UserProfile> {
  const uid = currentUid();
  const response = await apiRequest(API_ROUTES.profile, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return requireProfile(uid, response.body);
}

/**
 * POST /api/profile/avatar|banner (multipart, campo `file`). O upload vai para
 * a API, que envia ao V0X e grava apenas metadados no MongoDB (§13/§14) — o
 * app nunca fala com o V0X nem guarda binário.
 */
export async function uploadProfileImage(slot: ProfileImageSlot, blob: Blob): Promise<UserProfile> {
  const uid = currentUid();
  const ext = MIME_EXTENSIONS[blob.type] ?? 'img';
  const form = new FormData();
  form.append('file', blob, `${slot}.${ext}`);

  const route = slot === 'avatar' ? API_ROUTES.avatar : API_ROUTES.banner;
  const response = await apiRequest(route, {
    method: 'POST',
    body: form,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  return requireProfile(uid, response.body);
}
