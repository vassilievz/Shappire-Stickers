import { EDITOR_CONFIG } from '@/config/editor';
import { AppError } from '@/shared/errors';
import {
  base64ToDataUrl,
  createSurface,
  dataUrlMimeType,
  type CanvasFactory,
  defaultCanvasFactory,
} from './canvas';

export interface DecodedCanvasImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  resized: boolean;
}

export const SUPPORTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const;

export function isSupportedImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}


export function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new AppError('IMAGE_DECODE_FAILED', 'Ambiente sem suporte a imagens.'));
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new AppError('IMAGE_DECODE_FAILED', 'Não foi possível abrir esta imagem. Use PNG, JPEG ou WebP.'),
      );
    image.src = source;
  });
}


export function drawImageResized(
  image: CanvasImageSource & { width: number; height: number },
  options: { maxDimension?: number; factory?: CanvasFactory } = {},
): DecodedCanvasImage {
  const maxDimension = options.maxDimension ?? EDITOR_CONFIG.maxImportedImageDimension;
  const factory = options.factory ?? defaultCanvasFactory;
  const originalWidth = Math.max(1, Math.round(image.width));
  const originalHeight = Math.max(1, Math.round(image.height));
  const ratio = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * ratio));
  const height = Math.max(1, Math.round(originalHeight * ratio));
  const { canvas, ctx } = createSurface(width, height, factory);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return {
    canvas,
    width,
    height,
    originalWidth,
    originalHeight,
    resized: ratio < 1,
  };
}


export function detectAlphaChannel(
  canvas: HTMLCanvasElement,
  mimeType: string,
  sampleStep = 4,
): boolean {
  if (mimeType.toLowerCase().includes('jpeg') || mimeType.toLowerCase().includes('jpg')) {
    return false;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = Math.max(1, sampleStep);
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const index = (y * canvas.width + x) * 4 + 3;
        const alpha = data[index];
        if (alpha !== undefined && alpha < 250) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

export interface DecodeImageOptions {
  maxDimension?: number;
  factory?: CanvasFactory;
}


export async function decodeImageFromDataUrl(
  dataUrl: string,
  options: DecodeImageOptions = {},
): Promise<DecodedCanvasImage & { mimeType: string; hasAlpha: boolean }> {
  const mimeType = dataUrlMimeType(dataUrl);
  if (!isSupportedImageMimeType(mimeType)) {
    throw new AppError('IMAGE_DECODE_FAILED', `Formato não suportado: ${mimeType}. Use PNG, JPEG ou WebP.`);
  }
  const image = await loadImageElement(dataUrl);
  const decoded = drawImageResized(image, options);
  const hasAlpha = detectAlphaChannel(decoded.canvas, mimeType);
  return { ...decoded, mimeType, hasAlpha };
}

export async function decodeImageFromBase64(
  base64: string,
  mimeType: string,
  options: DecodeImageOptions = {},
): Promise<DecodedCanvasImage & { mimeType: string; hasAlpha: boolean }> {
  return decodeImageFromDataUrl(base64ToDataUrl(base64, mimeType), options);
}


export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new AppError('IMAGE_DECODE_FAILED', 'Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}
