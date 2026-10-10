import { create } from 'zustand';
import {
  observeAuthState,
  syncNativeAuthToWeb,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  logAnalyticsEvent,
  type AuthUser,
  type UserProfile,
} from '@/services/firebase';
import { loadProfile } from '@/services/profile/profileService';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('auth-store');

// Diagnóstico temporário do fluxo de login (remover após confirmar a causa da lentidão).
// console.info direto porque o logger do app filtra 'info' em build de produção e estes
// logs precisam ser visíveis no APK via `adb logcat`.
// eslint-disable-next-line no-console
const authLog = (stage: string, detail = '') => console.info(`[AUTH] ${stage}${detail ? ` — ${detail}` : ''}`);

function localProfile(user: AuthUser): UserProfile {
  return {
    uid: user.uid,
    displayName: user.displayName || 'Usuário Shappire',
    email: user.email || '',
    photoURL: user.photoURL,
    username: null,
    bio: '',
    // A foto do Google vive em photoURL; avatar só existe após upload via API.
    avatar: null,
    banner: null,
  };
}

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

    void syncNativeAuthToWeb();

    const unsubscribe = observeAuthState((user) => {
      authLog('onAuthStateChanged disparou', user ? `uid=${user.uid}` : 'sem usuário');
      if (user) {
        // Firebase Auth confirmou o usuário: publica o estado autenticado imediatamente.
        // A sincronização do perfil com a API é secundária e roda em background,
        // sem travar a UI em loading enquanto a rede responde.
        set({
          user,
          profile: localProfile(user),
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        authLog('Zustand atualizado para autenticado');

        const syncStart = Date.now();
        authLog('perfil API iniciado');
        void loadProfile()
          .then((profile) => {
            authLog('perfil API concluído', `${Date.now() - syncStart}ms`);
            if (profile && useAuthStore.getState().user?.uid === user.uid) {
              set({ profile });
            }
          })
          .catch((err) => {
            logger.debug('Falha na sincronização de perfil em background:', err);
          });
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
    authLog('login iniciado');
    void logAnalyticsEvent('login_started', { method: 'google' });

    try {
      const user = await firebaseSignInWithGoogle();
      authLog('Firebase sign-in concluído', `uid=${user.uid}`);

      // Autenticação confirmada pelo Firebase: a UI muda para o estado logado
      // imediatamente; a sincronização do perfil com a API roda em background.
      set({
        user,
        profile: localProfile(user),
        isAuthenticated: true,
        isSigningIn: false,
        error: null,
      });
      authLog('Zustand atualizado para autenticado (login)');

      const syncStart = Date.now();
      authLog('perfil API iniciado (login)');
      void loadProfile()
        .then((profile) => {
          authLog('perfil API concluído (login)', `${Date.now() - syncStart}ms`);
          if (profile && useAuthStore.getState().user?.uid === user.uid) {
            set({ profile });
          }
        })
        .catch((profErr) => {
          logger.debug('Falha não-bloqueante na sincronização do perfil:', profErr);
        });

      void logAnalyticsEvent('login_completed', { method: 'google' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar com o Google.';
      logger.warn('Falha no login com Google:', message);
      authLog('login falhou', message);
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
