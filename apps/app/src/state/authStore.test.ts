import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { loadProfile } from '@/services/profile/profileService';
import {
  logAnalyticsEvent,
  observeAuthState,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  type AuthUser,
} from '@/services/firebase';

vi.mock('@/services/firebase', () => ({
  observeAuthState: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('@/services/profile/profileService', () => ({
  loadProfile: vi.fn(),
}));

const mocks = {
  observeAuthState: vi.mocked(observeAuthState),
  signInWithGoogle: vi.mocked(firebaseSignInWithGoogle),
  signOut: vi.mocked(firebaseSignOut),
  logAnalyticsEvent: vi.mocked(logAnalyticsEvent),
  loadProfile: vi.mocked(loadProfile),
};

const authUser: AuthUser = {
  uid: 'user-1',
  displayName: 'Gabriel',
  email: 'gabriel@example.com',
  photoURL: 'https://lh3.googleusercontent.com/g.png',
};

/** Perfil local montado na hora do login, antes da API responder. */
const localProfile = {
  uid: 'user-1',
  displayName: 'Gabriel',
  email: 'gabriel@example.com',
  photoURL: 'https://lh3.googleusercontent.com/g.png',
  username: null,
  bio: '',
  avatar: null,
  banner: null,
};

const apiProfile = {
  ...localProfile,
  username: 'gabriel',
  bio: 'Criador de figurinhas',
};

function captureObserver(): (user: AuthUser | null) => void {
  let observer: ((user: AuthUser | null) => void) | undefined;
  mocks.observeAuthState.mockImplementation((callback) => {
    observer = callback;
    return () => {};
  });
  return (user: AuthUser | null) => observer?.(user);
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: false,
    isSigningIn: false,
    error: null,
  });
  mocks.observeAuthState.mockReset().mockReturnValue(() => {});
  mocks.signInWithGoogle.mockReset().mockResolvedValue(authUser);
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  mocks.logAnalyticsEvent.mockReset().mockResolvedValue(undefined);
  mocks.loadProfile.mockReset().mockResolvedValue(apiProfile);
});

describe('useAuthStore', () => {
  it('inicia com estado padrão deslogado', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('permite limpar erros com clearError', () => {
    useAuthStore.setState({ error: 'Erro de teste' });
    expect(useAuthStore.getState().error).toBe('Erro de teste');

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('executa signOut redefinindo o estado para deslogado', async () => {
    useAuthStore.setState({
      user: authUser,
      profile: apiProfile,
      isAuthenticated: true,
    });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});

describe('initialize — observeAuthState', () => {
  it('publica o usuário imediatamente e sincroniza o perfil da API em background', async () => {
    const emit = captureObserver();

    const unsubscribe = useAuthStore.getState().initialize();
    emit(authUser);

    // Estado autenticado já visível antes da rede responder (offline-first).
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().profile).toEqual(localProfile);
    expect(mocks.loadProfile).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile?.username).toBe('gabriel');
    });
    unsubscribe();
  });

  it('mantém o perfil local quando o documento ainda não existe na API', async () => {
    mocks.loadProfile.mockResolvedValue(null);
    const emit = captureObserver();

    const unsubscribe = useAuthStore.getState().initialize();
    emit(authUser);

    await flushMicrotasks();

    expect(useAuthStore.getState().profile).toEqual(localProfile);
    expect(useAuthStore.getState().error).toBeNull();
    unsubscribe();
  });

  it('não sobrescreve o perfil quando o usuário já trocou durante a sincronização', async () => {
    const emit = captureObserver();

    const unsubscribe = useAuthStore.getState().initialize();
    emit(authUser);

    // Outro usuário entrou antes da resposta da API chegar.
    useAuthStore.setState({ user: { ...authUser, uid: 'user-2' }, profile: null });

    await flushMicrotasks();

    expect(useAuthStore.getState().profile).toBeNull();
    unsubscribe();
  });

  it('usuário null desloga o estado', () => {
    const emit = captureObserver();

    const unsubscribe = useAuthStore.getState().initialize();
    emit(authUser);
    emit(null);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().profile).toBeNull();
    unsubscribe();
  });
});

describe('signInWithGoogle', () => {
  it('autentica e sincroniza o perfil da API em background', async () => {
    const result = await useAuthStore.getState().signInWithGoogle();

    expect(result).toBe(true);
    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.uid).toBe('user-1');
    expect(useAuthStore.getState().isSigningIn).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();

    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile?.username).toBe('gabriel');
    });
  });

  it('falha no Firebase mantém deslogado com erro, sem tocar na API', async () => {
    mocks.signInWithGoogle.mockRejectedValueOnce(new Error('popup fechado'));

    const result = await useAuthStore.getState().signInWithGoogle();

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isSigningIn).toBe(false);
    expect(useAuthStore.getState().error).toBe('popup fechado');
    expect(mocks.loadProfile).not.toHaveBeenCalled();
  });
});
