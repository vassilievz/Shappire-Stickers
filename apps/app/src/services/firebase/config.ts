import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('firebase-config');

/**
 * Configuração oficial do Firebase para o Shappire Stickers.
 * Prioriza variáveis de ambiente (Vite) e usa as chaves do projeto como fallback seguro.
 * (São credenciais client-side públicas e necessárias para o SDK conectar ao projeto).
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || 'AIzaSyDBkW-v06f0k4UHMdLsiKRUMqbD8JKtsqk',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'shappiresticker.firebaseapp.com',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'shappiresticker',
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'shappiresticker.firebasestorage.app',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '510767186684',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || '1:510767186684:web:76a22b3fbed9cf4f024d79',
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || 'G-XBFJ5K92XC',
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Retorna a instância inicializada do FirebaseApp (singleton).
 */
export function getFirebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(firebaseConfig);
      logger.info('Firebase inicializado com sucesso.');
    }
  } catch (error) {
    logger.error('Falha ao inicializar FirebaseApp:', error);
    throw error;
  }

  return appInstance;
}

/**
 * Retorna a instância do Firebase Authentication.
 */
export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  authInstance = getAuth(app);
  return authInstance;
}

/**
 * Retorna a Promise com a instância do Firebase Analytics se suportado no ambiente.
 * No Android WebView ou testes onde IndexedDB/cookies são limitados, resolve null com segurança.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    try {
      const supported = await isAnalyticsSupported();
      if (!supported) {
        logger.debug('Firebase Analytics não suportado neste ambiente.');
        return null;
      }
      const app = getFirebaseApp();
      return getAnalytics(app);
    } catch (err) {
      logger.debug('Não foi possível inicializar Firebase Analytics:', err);
      return null;
    }
  })();

  return analyticsPromise;
}
