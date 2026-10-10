import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useLibraryStore } from './libraryStore';
import { deriveProfileStats, type ProfileStats } from '@/domain/profile';
import { loadProfile, saveProfile, type ProfileDraft } from '@/services/profile/profileService';
import { saveAvatarDecoration } from '@/services/api/avatarDecorationApi';
import type { ActiveAvatarDecoration } from '@shappire/contracts';
import type { UserProfile } from '@/services/firebase/types';
import { loadCachedProfile, saveCachedProfile } from '@/services/storage/profileRepository';
import { toAppError, type AppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('profile-store');

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ProfileState {
  profile: UserProfile | null;
  status: ProfileStatus;
  /** true quando a exibição veio do cache e a atualização online ainda não respondeu */
  isStale: boolean;
  isSaving: boolean;
  decorationSaving: boolean;
  saveError: AppError | null;
  error: string | null;

  hydrate: () => Promise<void>;
  save: (draft: ProfileDraft) => Promise<boolean>;
  /** Atualização otimista + reconciliação ao equipar decoração de avatar. */
  equipAvatarDecoration: (input: {
    decorationId: string;
    decoration: ActiveAvatarDecoration;
  }) => Promise<boolean>;
  reset: () => void;
}

let activeUid: string | null = null;
let refreshInFlight: Promise<void> | null = null;
let decorationSaveGeneration = 0;
/** Incrementado em gravações locais recentes (ex.: decoração) para ignorar refresh obsoleto. */
let profileContentVersion = 0;

function publishProfile(profile: UserProfile, stale: boolean): void {
  useProfileStore.setState({ profile, status: 'ready', isStale: stale, error: null });
  if (useAuthStore.getState().user?.uid === profile.uid) {
    useAuthStore.setState({ profile });
  }
}

function mergeRemoteWithLocalDecoration(
  remote: UserProfile,
  local: UserProfile | null,
  versionAtRefreshStart: number,
): UserProfile {
  if (!local || local.uid !== remote.uid) return remote;
  if (profileContentVersion <= versionAtRefreshStart) return remote;

  const localDecorationId = local.avatarDecorationId ?? local.avatarDecoration?.id ?? null;
  const remoteDecorationId = remote.avatarDecorationId ?? remote.avatarDecoration?.id ?? null;
  if (!localDecorationId || localDecorationId === remoteDecorationId) {
    return remote;
  }

  return {
    ...remote,
    avatarDecorationId: localDecorationId,
    avatarDecoration: local.avatarDecoration ?? remote.avatarDecoration,
  };
}

async function refreshFromApi(uid: string): Promise<void> {
  const versionAtRefreshStart = profileContentVersion;
  try {
    const remote = await loadProfile();
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.uid !== uid) return;
    if (remote) {
      const local = useProfileStore.getState().profile;
      const merged = mergeRemoteWithLocalDecoration(remote, local, versionAtRefreshStart);
      publishProfile(merged, false);
      void saveCachedProfile(remote).catch((error) =>
        logger.debug('Falha ao gravar cache de perfil:', error),
      );
    } else {
      // Perfil ainda não criado na API (surge no primeiro PATCH) — estado válido.
      // Se houver perfil no authStore (ex: conta Google), usa-o como base pronta.
      const authProfile = useAuthStore.getState().profile;
      if (authProfile && authProfile.uid === uid) {
        publishProfile(authProfile, false);
      } else if (useProfileStore.getState().profile?.uid !== uid) {
        useProfileStore.setState({ profile: null, status: 'ready', isStale: false, error: null });
      }
    }
  } catch (error) {
    const appErr = toAppError(error);
    logger.warn('Perfil online indisponível:', appErr.code, appErr.message);
    if (useProfileStore.getState().profile?.uid !== uid) {
      const authProfile = useAuthStore.getState().profile;
      if (authProfile && authProfile.uid === uid) {
        publishProfile(authProfile, true);
      } else {
        useProfileStore.setState({ status: 'error', error: appErr.code });
      }
    }
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  status: 'idle',
  isStale: false,
  isSaving: false,
  decorationSaving: false,
  saveError: null,
  error: null,

  /**
   * Offline-first: publica o cache local imediatamente e atualiza com a API
   * em background — a tela de perfil nunca espera a rede.
   */
  hydrate: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) {
      activeUid = null;
      set({ profile: null, status: 'idle', isStale: false, error: null });
      return;
    }
    if (activeUid === uid && get().status !== 'idle') return;
    activeUid = uid;

    set({ status: 'loading', error: null });
    let hadCachedProfile = false;
    try {
      const cached = await loadCachedProfile(uid);
      if (useAuthStore.getState().user?.uid !== uid) return;
      if (cached) {
        hadCachedProfile = true;
        publishProfile(cached, true);
      }
    } catch (error) {
      logger.debug('Cache de perfil indisponível:', error);
    }

    if (!refreshInFlight) {
      refreshInFlight = refreshFromApi(uid).finally(() => {
        refreshInFlight = null;
      });
    }
    // Com cache local, não bloqueia a UI na rede — atualiza em background.
    if (!hadCachedProfile) {
      await refreshInFlight;
    }
  },

  equipAvatarDecoration: async ({ decorationId, decoration }) => {
    const current = get().profile;
    if (!current || get().decorationSaving) return false;

    const generation = ++decorationSaveGeneration;
    const snapshot = current;
    const optimistic: UserProfile = {
      ...current,
      avatarDecorationId: decorationId,
      avatarDecoration: decoration,
    };

    profileContentVersion += 1;
    publishProfile(optimistic, false);
    void saveCachedProfile(optimistic).catch((error) =>
      logger.debug('Falha ao gravar cache otimista de decoração:', error),
    );
    set({ decorationSaving: true, saveError: null });

    try {
      const remote = await saveAvatarDecoration(decorationId);
      if (generation !== decorationSaveGeneration) {
        return true;
      }
      publishProfile(remote, false);
      void saveCachedProfile(remote).catch((error) =>
        logger.debug('Falha ao gravar cache de decoração:', error),
      );
      set({ decorationSaving: false });
      return true;
    } catch (error) {
      if (generation === decorationSaveGeneration) {
        publishProfile(snapshot, get().isStale);
        void saveCachedProfile(snapshot).catch(() => {});
        set({ decorationSaving: false, saveError: toAppError(error) });
      }
      return false;
    }
  },

  save: async (draft) => {
    const uid = useAuthStore.getState().user?.uid;
    const current = get().profile;
    if (!uid || !current || get().isSaving) return false;

    set({ isSaving: true, saveError: null });
    try {
      const profile = await saveProfile(current, draft);
      publishProfile(profile, false);
      void saveCachedProfile(profile).catch((error) =>
        logger.debug('Falha ao gravar cache de perfil:', error),
      );
      set({ isSaving: false });
      return true;
    } catch (error) {
      logger.warn('Falha ao salvar perfil:', error);
      set({ isSaving: false, saveError: toAppError(error) });
      return false;
    }
  },

  reset: () => {
    activeUid = null;
    set({
      profile: null,
      status: 'idle',
      isStale: false,
      isSaving: false,
      decorationSaving: false,
      saveError: null,
      error: null,
    });
    decorationSaveGeneration = 0;
    profileContentVersion = 0;
  },
}));

/** Estatísticas reais derivadas da biblioteca local — nunca gravadas no servidor. */
export function useProfileStats(): ProfileStats {
  const packs = useLibraryStore((state) => state.packs);
  return deriveProfileStats(packs);
}
