import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useProfileStore } from './profileStore';
import type { ProfileDraft } from '@/services/profile/profileService';
import type { UserProfile } from '@/services/firebase/types';
import { AppError } from '@/shared/errors';
import { loadCachedProfile, saveCachedProfile } from '@/services/storage/profileRepository';
import { loadProfile, saveProfile } from '@/services/profile/profileService';

vi.mock('@/services/firebase', () => ({
  observeAuthState: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  logAnalyticsEvent: vi.fn(),
}));
vi.mock('@/services/storage/profileRepository', () => ({
  loadCachedProfile: vi.fn(),
  saveCachedProfile: vi.fn(),
}));
vi.mock('@/services/profile/profileService', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

const cacheMocks = {
  loadCachedProfile: vi.mocked(loadCachedProfile),
  saveCachedProfile: vi.mocked(saveCachedProfile),
};
const profileMocks = {
  loadProfile: vi.mocked(loadProfile),
  saveProfile: vi.mocked(saveProfile),
};

const cachedProfile: UserProfile = {
  uid: 'user-1',
  displayName: 'Gabriel (cache)',
  email: 'gabriel@example.com',
  photoURL: null,
  username: 'gabriel',
  bio: '',
  avatar: null,
  banner: null,
};

const remoteProfile: UserProfile = {
  ...cachedProfile,
  displayName: 'Gabriel (online)',
};

const authUser = {
  uid: 'user-1',
  displayName: 'Gabriel',
  email: 'gabriel@example.com',
  photoURL: null,
};

function signIn() {
  useAuthStore.setState({
    user: authUser,
    profile: null,
    isAuthenticated: true,
    isLoading: false,
    isSigningIn: false,
    error: null,
  });
}

beforeEach(() => {
  useProfileStore.getState().reset();
  useAuthStore.setState({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: false,
    isSigningIn: false,
    error: null,
  });
  profileMocks.loadProfile.mockReset();
  profileMocks.saveProfile.mockReset();
  cacheMocks.loadCachedProfile.mockReset().mockResolvedValue(null);
  cacheMocks.saveCachedProfile.mockReset().mockResolvedValue(undefined);
});

describe('useProfileStore — hydrate (offline-first)', () => {
  it('publica o cache imediatamente como stale e atualiza em background', async () => {
    signIn();
    cacheMocks.loadCachedProfile.mockResolvedValue(cachedProfile);

    let resolveRemote: (value: UserProfile | null) => void;
    profileMocks.loadProfile.mockImplementation(
      () => new Promise((resolve) => { resolveRemote = resolve; }),
    );

    const hydrating = useProfileStore.getState().hydrate();

    // Estado intermediário: cache em tela antes da rede responder.
    await vi.waitFor(() => {
      expect(useProfileStore.getState().profile?.displayName).toBe('Gabriel (cache)');
    });
    expect(useProfileStore.getState().isStale).toBe(true);

    resolveRemote!(remoteProfile);
    await hydrating;

    expect(useProfileStore.getState().profile?.displayName).toBe('Gabriel (online)');
    expect(useProfileStore.getState().isStale).toBe(false);
    expect(useProfileStore.getState().status).toBe('ready');
  });

  it('grava o perfil remoto no cache após atualizar', async () => {
    signIn();
    profileMocks.loadProfile.mockResolvedValue(remoteProfile);

    await useProfileStore.getState().hydrate();

    expect(cacheMocks.saveCachedProfile).toHaveBeenCalledWith(remoteProfile);
  });

  it('mantém o último estado conhecido quando a rede falha', async () => {
    signIn();
    cacheMocks.loadCachedProfile.mockResolvedValue(cachedProfile);
    profileMocks.loadProfile.mockRejectedValue(new AppError('NETWORK_ERROR', 'sem rede'));

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().profile?.displayName).toBe('Gabriel (cache)');
    expect(useProfileStore.getState().status).toBe('ready');
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('sinaliza erro apenas quando não há nada em tela', async () => {
    signIn();
    profileMocks.loadProfile.mockRejectedValue(new AppError('NETWORK_ERROR', 'sem rede'));

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().profile).toBeNull();
    expect(useProfileStore.getState().status).toBe('error');
  });

  it('não consulta nada sem usuário autenticado', async () => {
    await useProfileStore.getState().hydrate();

    expect(cacheMocks.loadCachedProfile).not.toHaveBeenCalled();
    expect(profileMocks.loadProfile).not.toHaveBeenCalled();
    expect(useProfileStore.getState().status).toBe('idle');
  });

  it('mantém o perfil local quando o documento ainda não existe na API', async () => {
    signIn();
    profileMocks.loadProfile.mockResolvedValue(null);

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().status).toBe('ready');
    expect(useProfileStore.getState().profile).toBeNull();
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('sincroniza o perfil publicado com o authStore', async () => {
    signIn();
    profileMocks.loadProfile.mockResolvedValue(remoteProfile);

    await useProfileStore.getState().hydrate();

    expect(useAuthStore.getState().profile?.displayName).toBe('Gabriel (online)');
  });
});

describe('useProfileStore — save', () => {
  const draft: ProfileDraft = {
    displayName: 'Gabriel Souza',
    username: 'gabriel',
    bio: 'nova bio',
    avatar: { kind: 'keep' },
    banner: { kind: 'keep' },
  };

  it('salva, publica e grava no cache', async () => {
    signIn();
    useProfileStore.setState({ profile: cachedProfile, status: 'ready' });
    const saved: UserProfile = { ...cachedProfile, bio: 'nova bio' };
    profileMocks.saveProfile.mockResolvedValue(saved);

    const ok = await useProfileStore.getState().save(draft);

    expect(ok).toBe(true);
    expect(profileMocks.saveProfile).toHaveBeenCalledWith(cachedProfile, draft);
    expect(useProfileStore.getState().profile?.bio).toBe('nova bio');
    expect(useProfileStore.getState().isStale).toBe(false);
    expect(cacheMocks.saveCachedProfile).toHaveBeenCalledWith(saved);
  });

  it('impede envios simultâneos (sem duplo submit)', async () => {
    signIn();
    useProfileStore.setState({ profile: cachedProfile, status: 'ready' });

    let resolveSave: (value: UserProfile) => void;
    profileMocks.saveProfile.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );

    const first = useProfileStore.getState().save(draft);
    const second = await useProfileStore.getState().save(draft);

    expect(second).toBe(false);
    expect(useProfileStore.getState().isSaving).toBe(true);

    resolveSave!({ ...cachedProfile, bio: 'nova bio' });
    expect(await first).toBe(true);
    expect(useProfileStore.getState().isSaving).toBe(false);
  });

  it('expõe o saveError e limpa isSaving quando falha', async () => {
    signIn();
    useProfileStore.setState({ profile: cachedProfile, status: 'ready' });
    profileMocks.saveProfile.mockRejectedValue(
      new AppError('INVALID_INPUT', 'Usuário já em uso.', {
        details: { field: 'username', reason: 'USERNAME_TAKEN' },
      }),
    );

    const ok = await useProfileStore.getState().save(draft);

    expect(ok).toBe(false);
    expect(useProfileStore.getState().isSaving).toBe(false);
    expect(useProfileStore.getState().saveError).toMatchObject({ code: 'INVALID_INPUT' });
    // Mantém o perfil anterior em tela.
    expect(useProfileStore.getState().profile?.displayName).toBe('Gabriel (cache)');
  });

  it('não salva sem perfil carregado', async () => {
    signIn();
    useProfileStore.setState({ profile: null, status: 'loading' });

    expect(await useProfileStore.getState().save(draft)).toBe(false);
    expect(profileMocks.saveProfile).not.toHaveBeenCalled();
  });
});
