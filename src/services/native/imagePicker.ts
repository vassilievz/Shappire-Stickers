import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { EDITOR_CONFIG } from '@/config/editor';
import { AppError, toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { decodeImageFromDataUrl, readFileAsDataUrl } from '@/services/imaging/imageLoader';

const log = createLogger('image-picker');

export interface PickedImage {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  hasAlpha: boolean;
  resized: boolean;
  fileName: string;
  isAnimated?: boolean;
}


export async function pickImagesFromGallery(options: { maxImages?: number } = {}): Promise<PickedImage[]> {
  const maxImages = Math.max(1, Math.min(options.maxImages ?? 1, 10));

  if (Capacitor.isNativePlatform()) {
    try {
      const results = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: maxImages > 1,
        limit: maxImages,
        editable: 'no',
      });

      const picked: PickedImage[] = [];
      for (const [index, item] of results.results.entries()) {
        const dataUrl = await resolveMediaResult(item);
        if (!dataUrl) continue;
        picked.push(await dataUrlToPickedImage(dataUrl, `imagem_${Date.now()}_${index + 1}`));
      }
      if (picked.length > 0) return picked;
      log.warn('Seletor nativo não retornou imagens; usando seletor do sistema.');
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === 'CANCELLED') throw appError;
      log.warn('Seletor nativo indisponível; usando seletor do sistema.', error);
    }
  }

  return pickViaFileInput(maxImages);
}

export async function pickSingleImage(): Promise<PickedImage> {
  const images = await pickImagesFromGallery({ maxImages: 1 });
  const first = images[0];
  if (!first) {
    throw new AppError('CANCELLED', 'Nenhuma imagem foi selecionada.');
  }
  return first;
}

async function resolveMediaResult(item: MediaResult): Promise<string | null> {
  if (item.webPath) {
    try {
      const response = await fetch(item.webPath);
      const blob = await response.blob();
      return await readFileAsDataUrl(blob);
    } catch (error) {
      log.warn('Falha ao ler webPath; tentando URI nativa.', error);
    }
  }

  if (item.uri) {
    try {
      const file = await Filesystem.readFile({ path: item.uri });
      if (typeof file.data === 'string') {
        return `data:${guessMimeFromUri(item.uri)};base64,${file.data}`;
      }
    } catch (error) {
      log.warn('Falha ao ler URI nativa; tentando miniatura.', error);
    }
  }

  if (item.thumbnail) {
    return item.thumbnail.startsWith('data:')
      ? item.thumbnail
      : `data:image/jpeg;base64,${item.thumbnail}`;
  }
  return null;
}

function guessMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}


export function pickViaFileInput(maxImages: number): Promise<PickedImage[]> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new AppError('NATIVE_UNAVAILABLE', 'Seletor de imagens indisponível neste ambiente.'));
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.multiple = maxImages > 1;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.setAttribute('aria-label', 'Selecionar imagens da galeria');

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    const finish = async () => {
      if (settled) return;
      settled = true;
      const files = Array.from(input.files ?? []);
      cleanup();
      if (files.length === 0) {
        reject(new AppError('CANCELLED', 'Nenhuma imagem foi selecionada.'));
        return;
      }
      try {
        const picked: PickedImage[] = [];
        for (const [index, file] of files.slice(0, maxImages).entries()) {
          const dataUrl = await readFileAsDataUrl(file);
          const baseName = stripExtension(file.name);
          picked.push(await dataUrlToPickedImage(dataUrl, baseName || `imagem_${index + 1}`));
        }
        resolve(picked);
      } catch (error) {
        reject(toAppError(error, 'IMAGE_DECODE_FAILED'));
      }
    };

    input.addEventListener('change', () => void finish());
    input.addEventListener('cancel', () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new AppError('CANCELLED', 'Nenhuma imagem foi selecionada.'));
    });

    document.body.appendChild(input);
    input.click();
  });
}

function stripExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}


export async function dataUrlToPickedImage(dataUrl: string, fileName: string): Promise<PickedImage> {
  try {
    const isGif = dataUrl.startsWith('data:image/gif') || dataUrl.includes('image/gif');
    if (isGif) {
      const { dataUrlToUint8Array, decodeGif, isGifBuffer } = await import(
        '@/services/imaging/gifDecoder'
      );
      const bytes = await dataUrlToUint8Array(dataUrl);
      if (isGifBuffer(bytes)) {
        try {
          const decodedGif = decodeGif(bytes);
          if (decodedGif.isAnimated) {
            return {
              dataUrl,
              mimeType: 'image/gif',
              width: decodedGif.width,
              height: decodedGif.height,
              originalWidth: decodedGif.width,
              originalHeight: decodedGif.height,
              hasAlpha: true,
              resized: false,
              fileName,
              isAnimated: true,
            };
          }
        } catch (gifErr) {
          log.warn('Tentativa de decodificação como GIF falhou; tentando decodificador padrão.', gifErr);
        }
      }
    }

    const decoded = await decodeImageFromDataUrl(dataUrl, {
      maxDimension: EDITOR_CONFIG.maxImportedImageDimension,
    });
    return {
      dataUrl,
      mimeType: decoded.mimeType,
      width: decoded.width,
      height: decoded.height,
      originalWidth: decoded.originalWidth,
      originalHeight: decoded.originalHeight,
      hasAlpha: decoded.hasAlpha,
      resized: decoded.resized,
      fileName,
      isAnimated: false,
    };
  } catch (error) {
    throw toAppError(error, 'IMAGE_DECODE_FAILED');
  }
}
