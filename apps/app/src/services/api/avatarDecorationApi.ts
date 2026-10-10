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
import {
  readCachedCatalog,
  writeCachedCatalog,
} from '@/services/avatarDecorations/decorationCatalogCache';

let memoryCatalog: AvatarDecorationCatalogResponse | null = null;
let catalogInflight: Promise<AvatarDecorationCatalogResponse> | null = null;

export function peekAvatarDecorationCatalog(): AvatarDecorationCatalogResponse | null {
  return memoryCatalog ?? readCachedCatalog();
}

export async function fetchAvatarDecorationCatalog(
  options?: { force?: boolean },
): Promise<AvatarDecorationCatalogResponse> {
  if (!options?.force) {
    if (memoryCatalog) return memoryCatalog;
    const disk = readCachedCatalog();
    if (disk) {
      memoryCatalog = disk;
    }
  }

  if (catalogInflight) return catalogInflight;

  catalogInflight = apiRequest(API_ROUTES.avatarDecorationsCatalog)
    .then((res) => {
      const catalog = res.body as AvatarDecorationCatalogResponse;
      memoryCatalog = catalog;
      writeCachedCatalog(catalog);
      return catalog;
    })
    .finally(() => {
      catalogInflight = null;
    });

  return catalogInflight;
}

function currentUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid || useAuthStore.getState().user?.uid;
  if (!uid) {
    throw new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre novamente para continuar.');
  }
  return uid;
}

let saveInflight: Promise<UserProfile> | null = null;
let saveInflightDecorationId: string | null = null;

export async function saveAvatarDecoration(decorationId: string): Promise<UserProfile> {
  if (saveInflight && saveInflightDecorationId === decorationId) {
    return saveInflight;
  }

  const uid = currentUid();
  const request = apiRequest(API_ROUTES.profileAvatarDecoration, {
    method: 'PATCH',
    body: JSON.stringify({ decorationId }),
  })
    .then((res) => {
      const profile = toUserProfile(uid, res.body);
      if (!profile) {
        throw new AppError('DATA_CORRUPTED', 'Resposta inválida ao salvar decoração.');
      }
      return profile;
    })
    .finally(() => {
      if (saveInflightDecorationId === decorationId) {
        saveInflight = null;
        saveInflightDecorationId = null;
      }
    });

  saveInflight = request;
  saveInflightDecorationId = decorationId;
  return request;
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

export function resetAvatarDecorationApiCaches(): void {
  memoryCatalog = null;
  catalogInflight = null;
  saveInflight = null;
  saveInflightDecorationId = null;
}
