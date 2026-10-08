import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from './config';
import type { AuthUser, UserProfile } from './types';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('firebase-firestore');

/**
 * Cria ou atualiza o documento `users/{uid}` no Cloud Firestore.
 * - Utiliza `setDoc(..., { merge: true })` para não sobrescrever dados adicionais existentes.
 * - Registra `createdAt` na criação e `updatedAt` em cada sincronização.
 * - Em caso de falha de rede/offline, retorna um perfil em memória seguro para não travar a UI.
 */
export async function syncUserProfile(user: AuthUser): Promise<UserProfile> {
  const defaultProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Usuário Shappire',
    email: user.email || '',
    photoURL: user.photoURL,
  };

  try {
    const firestore = getFirebaseFirestore();
    const userRef = doc(firestore, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      // Primeiro login: cria o documento inicial
      const initialData = {
        uid: user.uid,
        displayName: defaultProfile.displayName,
        email: defaultProfile.email,
        photoURL: defaultProfile.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, initialData, { merge: true });
      logger.info('Documento de usuário criado no Firestore:', user.uid);
    } else {
      // Usuário existente: atualiza apenas campos de identidade mais recentes
      const updateData = {
        displayName: defaultProfile.displayName,
        email: defaultProfile.email,
        photoURL: defaultProfile.photoURL,
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, updateData, { merge: true });
      logger.info('Documento de usuário atualizado no Firestore:', user.uid);
    }

    return defaultProfile;
  } catch (error) {
    logger.warn('Não foi possível sincronizar o perfil no Firestore (possível modo offline):', error);
    // Retorna perfil local em caso de erro/offline para não interromper a navegação
    return defaultProfile;
  }
}

/**
 * Consulta o perfil de um usuário no Firestore.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const firestore = getFirebaseFirestore();
    const userRef = doc(firestore, 'users', uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      uid: data.uid || uid,
      displayName: data.displayName || 'Usuário Shappire',
      email: data.email || '',
      photoURL: data.photoURL || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || undefined,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || undefined,
    };
  } catch (error) {
    logger.warn('Falha ao buscar perfil no Firestore:', error);
    return null;
  }
}
