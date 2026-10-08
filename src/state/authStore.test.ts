import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
      isSigningIn: false,
      error: null,
    });
  });

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
      user: {
        uid: '123',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      profile: {
        uid: '123',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      isAuthenticated: true,
    });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
