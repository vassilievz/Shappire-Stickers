import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from './config';
import { createLogger } from '@/services/logging/logger';
import { AppError } from '@/shared/errors';

const logger = createLogger('firebase-storage');

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Faz o upload seguro da foto de perfil do usuário para o Firebase Storage.
 * Caminho: `users/{uid}/profile/avatar.webp`
 *
 * Validações de segurança:
 * - Apenas imagens (jpeg, png, webp)
 * - Tamanho máximo de 5MB
 */
export async function uploadProfilePicture(
  uid: string,
  imageBlob: Blob | File,
  contentType = 'image/webp',
): Promise<string> {
  if (!uid) {
    throw new AppError('INVALID_INPUT', 'UID do usuário obrigatório para upload.');
  }

  if (imageBlob.size > MAX_AVATAR_BYTES) {
    throw new AppError(
      'IMAGE_TOO_LARGE',
      'A imagem excede o tamanho máximo permitido de 5 MB.',
    );
  }

  const effectiveType = imageBlob.type || contentType;
  if (!ALLOWED_MIME_TYPES.has(effectiveType)) {
    throw new AppError(
      'UNSUPPORTED_FORMAT',
      'Formato de imagem não suportado. Use PNG, JPEG ou WebP.',
    );
  }

  try {
    const storage = getFirebaseStorage();
    const avatarRef = ref(storage, `users/${uid}/profile/avatar.webp`);

    const snapshot = await uploadBytes(avatarRef, imageBlob, {
      contentType: effectiveType,
      cacheControl: 'public, max-age=3600',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    logger.info('Foto de perfil enviada com sucesso para Storage:', downloadUrl);
    return downloadUrl;
  } catch (error) {
    logger.warn('Falha no upload da foto de perfil:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      'STORAGE_UPLOAD_FAILED',
      'Não foi possível enviar a foto para o Firebase Storage. Verifique a conexão.',
    );
  }
}
