import { toUserProfile } from '@/services/api/profileApi';
import type { UserProfile } from '@/services/firebase/types';
import { SCHEMA_VERSION } from '@/config/storage';
import { readJson, writeJson } from './jsonStore';
import { profileCachePath } from './paths';

interface ProfileCacheDocument {
  schemaVersion: number;
  profile: Record<string, unknown>;
}

/**
 * Cache local do perfil (offline-first): último estado conhecido por uid.
 * A leitura reutiliza a sanitização da API — cache corrompido nunca
 * vira estado inválido na UI.
 */
export async function loadCachedProfile(uid: string): Promise<UserProfile | null> {
  const { data } = await readJson<ProfileCacheDocument>(profileCachePath(uid));
  if (!data?.profile || typeof data.profile !== 'object') return null;
  return toUserProfile(uid, data.profile);
}

export async function saveCachedProfile(profile: UserProfile): Promise<void> {
  await writeJson(profileCachePath(profile.uid), {
    schemaVersion: SCHEMA_VERSION,
    profile: { ...profile },
  });
}
