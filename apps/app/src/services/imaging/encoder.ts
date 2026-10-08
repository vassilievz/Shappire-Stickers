import { AppError } from '@/shared/errors';
import { base64ByteSize, canvasToDataUrl, dataUrlToBase64 } from './canvas';


export type EncodeFormat = 'image/webp' | 'image/png' | 'image/jpeg';

export interface EncodedImage {
  base64: string;
  mimeType: EncodeFormat;
  sizeBytes: number;
  quality: number;
  width: number;
  height: number;
}


export interface ImageEncoder {
  encode(canvas: HTMLCanvasElement, format: EncodeFormat, quality: number): Promise<EncodedImage>;
  supports(format: EncodeFormat): boolean;
}


export function detectWebpEncodingSupport(factory?: () => HTMLCanvasElement): boolean {
  try {
    const canvas = factory
      ? factory()
      : Object.assign(document.createElement('canvas'), { width: 2, height: 2 });
    const dataUrl = canvas.toDataURL('image/webp');
    return dataUrl.startsWith('data:image/webp');
  } catch {
    return false;
  }
}


export function createBrowserImageEncoder(): ImageEncoder {
  const webpSupported = detectWebpEncodingSupport();

  return {
    supports(format) {
      if (format === 'image/webp') return webpSupported;
      return true;
    },

    async encode(canvas, format, quality) {
      if (!this.supports(format)) {
        throw new AppError('WEBP_UNSUPPORTED', 'Este dispositivo não consegue gerar WebP.');
      }
      const base64 = await encodeToBase64(canvas, format, quality);
      return {
        base64,
        mimeType: format,
        sizeBytes: base64ByteSize(base64),
        quality,
        width: canvas.width,
        height: canvas.height,
      };
    },
  };
}

export async function encodeToBase64(
  canvas: HTMLCanvasElement,
  format: EncodeFormat,
  quality: number,
): Promise<string> {
  const blob = await toBlob(canvas, format, quality);
  if (blob) {
    const dataUrl = await blobToDataUrl(blob);
    return dataUrlToBase64(dataUrl);
  }
  const dataUrl = canvasToDataUrl(canvas, format, quality);
  if (!dataUrl.startsWith(`data:${format}`)) {
    throw new AppError('IMAGE_ENCODE_FAILED', `O dispositivo não suporta ${format}.`);
  }
  return dataUrlToBase64(dataUrl);
}

function toBlob(canvas: HTMLCanvasElement, format: EncodeFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    try {
      canvas.toBlob(
        (blob) => resolve(blob),
        format,
        Math.max(0, Math.min(1, quality)),
      );
    } catch {
      resolve(null);
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new AppError('IMAGE_ENCODE_FAILED', 'Falha ao ler a imagem gerada.'));
    reader.readAsDataURL(blob);
  });
}
