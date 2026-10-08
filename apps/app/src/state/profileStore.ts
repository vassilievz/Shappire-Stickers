import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useLibraryStore } from './libraryStore';
import { deriveProfileStats, type ProfileStats } from '@/domain/profile';
import { loadProfile, saveProfile, type ProfileDraft } from '@/services/profile/profileService';
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
  saveError: AppError | null;
  error: string | null;

  hydrate: () => Promise<void>;
  save: (draft: ProfileDraft) => Promise<boolean>;
  reset: () => void;
}

let activeUid: string | null = null;
let refreshInFlight: Promise<void> | null = null;

function publishProfile(profile: UserProfile, stale: boolean): void {
  useProfileStore.setState({ profile, status: 'ready', isStale: stale, error: null });
  if (useAuthStore.getState().user?.uid === profile.uid) {
    useAuthStore.setState({ profile });
  }
}

async function refreshFromApi(uid: string): Promise<void> {
  try {
    const remote = await loadProfile();
    if (useAuthStore.getState().user?.uid !== uid) return;
    if (remote) {
      publishProfile(remote, false);
      void saveCachedProfile(remote).catch((error) =>
        logger.debug('Falha ao gravar cache de perfil:', error),
      );
    } else if (useProfileStore.getState().profile?.uid !== uid) {
      // Perfil ainda não criado na API (surge no primeiro PATCH) — estado
      // válido e não é erro: a tela abre em branco, pronta para edição.
      useProfileStore.setState({ profile: null, status: 'ready', isStale: false, error: null });
    }
  } catch (error) {
    // Mantém o último estado conhecido; sinaliza apenas se não há nada em tela.
    logger.debug('Perfil online indisponível (offline?):', error);
    if (useProfileStore.getState().profile?.uid !== uid) {
      useProfileStore.setState({ status: 'error', error: 'NETWORK_ERROR' });
    }
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  status: 'idle',
  isStale: false,
  isSaving: false,
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
    try {
      const cached = await loadCachedProfile(uid);
      if (useAuthStore.getState().user?.uid !== uid) return;
      if (cached) {
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
    await refreshInFlight;
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
      saveError: null,
      error: null,
    });
  },
}));

/** Estatísticas reais derivadas da biblioteca local — nunca gravadas no servidor. */
export function useProfileStats(): ProfileStats {
  const packs = useLibraryStore((state) => state.packs);
  return deriveProfileStats(packs);
}
