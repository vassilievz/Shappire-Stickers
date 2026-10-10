import {
  API_ROUTES,
  type AvatarDecorationCatalogResponse,
} from '@shappire/contracts';
import { apiRequest } from './client';
import { getFirebaseAuth } from '@/services/firebase/config';
import { useAuthStore } from '@/state/authStore';
import { AppError } from '@/shared/errors';
import type { UserProfile } from '@/services/firebase/types';
import { toUserProfile } from './profileApi';

let catalogCache: AvatarDecorationCatalogResponse | null = null;

export async function fetchAvatarDecorationCatalog(): Promise<AvatarDecorationCatalogResponse> {
  if (catalogCache) return catalogCache;
  const res = await apiRequest(API_ROUTES.avatarDecorationsCatalog);
  catalogCache = res.body as AvatarDecorationCatalogResponse;
  return catalogCache;
}

function currentUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid || useAuthStore.getState().user?.uid;
  if (!uid) {
    throw new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre novamente para continuar.');
  }
  return uid;
}

export async function saveAvatarDecoration(decorationId: string): Promise<UserProfile> {
  const uid = currentUid();
  const res = await apiRequest(API_ROUTES.profileAvatarDecoration, {
    method: 'PATCH',
    body: JSON.stringify({ decorationId }),
  });
  const profile = toUserProfile(uid, res.body);
  if (!profile) {
    throw new AppError('DATA_CORRUPTED', 'Resposta inválida ao salvar decoração.');
  }
  return profile;
}

export async function clearAvatarDecoration(): Promise<UserProfile> {
  const uid = currentUid();
  const res = await apiRequest(API_ROUTES.profileAvatarDecoration, { method: 'DELETE' });
  const profile = toUserProfile(uid, res.body);
  if (!profile) {
    throw new AppError('DATA_CORRUPTED', 'Resposta inválida ao remover decoração.');
  }
  return profile;
}
