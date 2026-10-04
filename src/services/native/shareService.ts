import { Share } from '@capacitor/share';
import { AppError, toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from '@/services/storage/gateway';

const log = createLogger('share-service');


export async function shareStickerFile(relativePath: string, mimeType = 'image/webp'): Promise<void> {
  const gateway = getFileSystemGateway();
  try {
    const uri = await gateway.getFileUri(relativePath);
    const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    await Share.share({
      files: [fileUri],
      dialogTitle: 'Compartilhar figurinha',
      text: `Figurinha criada no Shappire Stickers (${mimeType})`,
    });
  } catch (error) {
    const appError = toAppError(error);
    log.warn('Falha ao compartilhar', appError);
    if (appError.code === 'NATIVE_UNAVAILABLE') throw appError;
    throw new AppError('INVALID_INPUT', 'Não foi possível compartilhar este arquivo.', {
      cause: error,
    });
  }
}

export async function canShare(): Promise<boolean> {
  try {
    const result = await Share.canShare();
    return result.value;
  } catch {
    return false;
  }
}
