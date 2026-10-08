import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './config';
import type { AuthUser } from './types';
import { createLogger } from '@/services/logging/logger';
import { AppError } from '@/shared/errors';

const logger = createLogger('firebase-auth');

// Diagnóstico temporário do fluxo de login (remover após confirmar a causa da lentidão).
// eslint-disable-next-line no-console
const authLog = (stage: string, detail = '') => console.info(`[AUTH] ${stage}${detail ? ` — ${detail}` : ''}`);

function mapUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    emailVerified: user.emailVerified,
  };
}

function handleAuthError(error: unknown): Error {
  logger.warn('Erro durante autenticação:', error);

  if (error instanceof AppError) {
    return error;
  }

  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as { code?: string })?.code;

  if (
    errCode === 'auth/popup-closed-by-user' ||
    errCode === 'auth/cancelled-popup-request' ||
    errMessage.includes('canceled') ||
    errMessage.includes('cancelled') ||
    errMessage.includes('12501') // Google Sign-In user canceled code
  ) {
    return new AppError('AUTH_CANCELLED', 'O login com o Google foi cancelado.');
  }

  if (errCode === 'auth/network-request-failed' || errMessage.includes('network')) {
    return new AppError('NETWORK_ERROR', 'Sem conexão com a internet. Verifique sua rede e tente novamente.');
  }

  if (errMessage.includes('Default FirebaseApp is not initialized') || errMessage.includes('google-services.json')) {
    return new AppError(
      'NATIVE_CONFIG_MISSING',
      'Configuração nativa do Firebase pendente no Android (google-services.json).',
    );
  }

  return new AppError('AUTH_FAILED', 'Não foi possível concluir o login com o Google. Tente novamente.');
}

/**
 * Realiza o login com Google.
 * - No Android/iOS: utiliza a autenticação nativa do Capacitor (Play Services / Credential Manager)
 *   e sincroniza as credenciais com o SDK Web do Firebase.
 * - No Navegador / Web: utiliza `signInWithPopup` padrão do Firebase Auth.
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  const auth = getFirebaseAuth();
  const t0 = Date.now();

  try {
    if (Capacitor.isNativePlatform()) {
      logger.info('Iniciando Google Sign-In nativo via Capacitor...');
      authLog('login iniciado (nativo)');
      const result = await FirebaseAuthentication.signInWithGoogle();
      authLog('Google retornou', `+${Date.now() - t0}ms`);

      // Sincroniza o idToken nativo com a instância web do Firebase Auth
      // para que o ID token do app (requisições à API) fique ativo.
      if (result.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        authLog('Firebase sign-in concluído (signInWithCredential)', `+${Date.now() - t0}ms`);
        logger.info('Usuário autenticado nativamente e sincronizado:', userCredential.user.uid);
        return mapUser(userCredential.user);
      }

      if (auth.currentUser) {
        return mapUser(auth.currentUser);
      }

      if (result.user) {
        return {
          uid: result.user.uid,
          displayName: result.user.displayName ?? null,
          email: result.user.email ?? null,
          photoURL: result.user.photoUrl ?? null,
          emailVerified: result.user.emailVerified,
        };
      }

      throw new AppError('AUTH_FAILED', 'Nenhuma credencial retornada pelo Google Sign-In.');
    }

    // Ambiente Web / Desktop / Dev
    logger.info('Iniciando Google Sign-In web (popup)...');
    authLog('login iniciado (web)');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const userCredential = await signInWithPopup(auth, provider);
    authLog('Firebase sign-in concluído (popup)', `+${Date.now() - t0}ms`);
    logger.info('Usuário autenticado no ambiente Web:', userCredential.user.uid);
    return mapUser(userCredential.user);
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Encerra a sessão do usuário.
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();

  try {
    if (Capacitor.isNativePlatform()) {
      try {
        await FirebaseAuthentication.signOut();
      } catch (nativeErr) {
        logger.debug('Falha silenciosa no signOut nativo:', nativeErr);
      }
    }

    await fbSignOut(auth);
    logger.info('Sessão encerrada com sucesso.');
  } catch (error) {
    logger.warn('Erro ao encerrar sessão:', error);
    throw handleAuthError(error);
  }
}

/**
 * Retorna o usuário atualmente autenticado ou null se deslogado.
 */
export function getCurrentUser(): AuthUser | null {
  try {
    const auth = getFirebaseAuth();
    return auth.currentUser ? mapUser(auth.currentUser) : null;
  } catch {
    return null;
  }
}

/**
 * Observa alterações no estado de autenticação (login, logout, refresh).
 */
export function observeAuthState(callback: (user: AuthUser | null) => void): () => void {
  try {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(
      auth,
      (user) => {
        callback(user ? mapUser(user) : null);
      },
      (error) => {
        logger.warn('Erro no observer de auth:', error);
        callback(null);
      },
    );
  } catch (error) {
    logger.warn('Falha ao registrar observer de autenticação:', error);
    callback(null);
    return () => {};
  }
}
