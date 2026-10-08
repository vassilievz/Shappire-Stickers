import { create } from 'zustand';
import {
  observeAuthState,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  syncUserProfile,
  logAnalyticsEvent,
  type AuthUser,
  type UserProfile,
} from '@/services/firebase';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('auth-store');

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;

  initialize: () => () => void;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  isSigningIn: false,
  error: null,

  initialize: () => {
    if (initialized) {
      return () => {};
    }
    initialized = true;

    logger.debug('Inicializando listener de autenticação global...');

    const unsubscribe = observeAuthState(async (user) => {
      if (user) {
        // Usuário logado: busca/sincroniza o perfil no Firestore
        try {
          const profile = await syncUserProfile(user);
          set({
            user,
            profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          logger.warn('Falha ao sincronizar perfil do usuário:', err);
          set({
            user,
            profile: {
              uid: user.uid,
              displayName: user.displayName || 'Usuário Shappire',
              email: user.email || '',
              photoURL: user.photoURL,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    });

    return () => {
      initialized = false;
      unsubscribe();
    };
  },

  signInWithGoogle: async () => {
    set({ isSigningIn: true, error: null });
    void logAnalyticsEvent('login_started', { method: 'google' });

    try {
      const user = await firebaseSignInWithGoogle();
      let profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || 'Usuário Shappire',
        email: user.email || '',
        photoURL: user.photoURL,
      };

      try {
        profile = await syncUserProfile(user);
      } catch (profErr) {
        logger.debug('Falha não-bloqueante na sincronização inicial do Firestore:', profErr);
      }

      set({
        user,
        profile,
        isAuthenticated: true,
        isSigningIn: false,
        error: null,
      });

      void logAnalyticsEvent('login_completed', { method: 'google' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar com o Google.';
      logger.warn('Falha no login com Google:', message);
      set({
        isSigningIn: false,
        error: message,
      });
      return false;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut();
      void logAnalyticsEvent('logout');
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sair da conta.';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
