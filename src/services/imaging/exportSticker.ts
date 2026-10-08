import { EDITOR_CONFIG } from '@/config/editor';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import type { EditorElement } from '@/domain/editor/elements';
import { centerInCanvas, fitInsideBox } from '@/domain/editor/geometry';
import { AppError } from '@/shared/errors';
import {
  base64ToDataUrl,
  base64ByteSize,
  createSurface,
  disposeCanvas,
  type CanvasFactory,
  defaultCanvasFactory,
  getContext2D,
} from './canvas';
import { createBrowserImageEncoder, type ImageEncoder } from './encoder';
import { loadImageElement } from './imageLoader';
import { renderStickerToCanvas } from './renderer';
import type { RasterResources } from './rasterCache';
import { logAnalyticsEvent } from '@/services/firebase/analytics';


export const WEBP_QUALITY_STEPS = [0.95, 0.9, 0.85, 0.8, 0.72, 0.62, 0.5] as const;

export interface StickerRenderRequest {
  elements: readonly EditorElement[];
  resources: RasterResources;
  hiddenElementIds?: ReadonlySet<string>;
}

export interface ExportedStickerArtwork {
  base64: string;
  sizeBytes: number;
  width: number;
  height: number;
  quality: number;
  mimeType: 'image/webp';
  warnings: string[];
}

export interface ExportStickerOptions {
  encoder?: ImageEncoder;
  factory?: CanvasFactory;
  canvasSize?: number;
  maxBytes?: number;
  
  targetDimension?: number;
}


export async function exportStickerArtwork(
  request: StickerRenderRequest,
  options: ExportStickerOptions = {},
): Promise<ExportedStickerArtwork> {
  const dimension = options.targetDimension ?? WHATSAPP_LIMITS.STICKER_DIMENSION;
  const canvasSize = options.canvasSize ?? EDITOR_CONFIG.canvasSize;
  const maxBytes = options.maxBytes ?? WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES;
  const encoder = options.encoder ?? createBrowserImageEncoder();

  if (request.elements.length === 0) {
    throw new AppError('INVALID_INPUT', 'Adicione uma imagem, texto ou desenho antes de exportar a figurinha.');
  }
  if (!encoder.supports('image/webp')) {
    throw new AppError(
      'WEBP_UNSUPPORTED',
      'Este WebView não consegue gerar arquivos WebP. Atualize o Android System WebView e tente novamente.',
    );
  }

  const warnings = collectWarnings(request.elements);
  const canvas = renderStickerToCanvas(request.elements, {
    resources: request.resources,
    canvasSize,
    scale: 1,
    factory: options.factory,
    hiddenElementIds: request.hiddenElementIds,
  });

  try {
    if (canvas.width !== dimension || canvas.height !== dimension) {
      throw new AppError(
        'STICKER_INVALID_DIMENSIONS',
        `A figurinha precisa ter exatamente ${dimension} x ${dimension} pixels.`,
        { details: { width: canvas.width, height: canvas.height } },
      );
    }

    const encoded = await encodeWithinLimit(canvas, encoder, maxBytes);
    void logAnalyticsEvent('sticker_exported', { mime_type: 'image/webp' });
    return {
      base64: encoded.base64,
      sizeBytes: encoded.sizeBytes,
      width: canvas.width,
      height: canvas.height,
      quality: encoded.quality,
      mimeType: 'image/webp',
      warnings,
    };
  } finally {
    disposeCanvas(canvas);
  }
}


export async function encodeWithinLimit(
  canvas: HTMLCanvasElement,
  encoder: ImageEncoder,
  maxBytes: number,
  format: 'image/webp' | 'image/png' = 'image/webp',
): Promise<{ base64: string; sizeBytes: number; quality: number }> {
  let lastSize = 0;
  for (const quality of WEBP_QUALITY_STEPS) {
    const encoded = await encoder.encode(canvas, format, quality);
    lastSize = encoded.sizeBytes;
    if (encoded.sizeBytes <= maxBytes) {
      return { base64: encoded.base64, sizeBytes: encoded.sizeBytes, quality };
    }
  }
  throw new AppError(
    'STICKER_TOO_LARGE',
    `A imagem ficou com ${Math.ceil(lastSize / 1024)} KB e o limite do WhatsApp é ${Math.round(maxBytes / 1024)} KB.`,
    { details: { sizeBytes: lastSize, maxBytes } },
  );
}

export interface ExportedTrayImage {
  base64: string;
  sizeBytes: number;
  width: number;
  height: number;
  format: 'image/png' | 'image/webp';
}


export async function exportTrayIconFromCanvas(
  source: HTMLCanvasElement,
  options: { size?: number; encoder?: ImageEncoder; factory?: CanvasFactory } = {},
): Promise<ExportedTrayImage> {
  const size = options.size ?? WHATSAPP_LIMITS.TRAY_IMAGE_SIZE;
  const encoder = options.encoder ?? createBrowserImageEncoder();
  const factory = options.factory ?? defaultCanvasFactory;
  const { canvas, ctx } = createSurface(size, size, factory);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source, 0, 0, size, size);

  try {
    const png = await encoder.encode(canvas, 'image/png', 1);
    if (png.sizeBytes <= WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES) {
      return { base64: png.base64, sizeBytes: png.sizeBytes, width: size, height: size, format: 'image/png' };
    }
    if (encoder.supports('image/webp')) {
      const webp = await encodeWithinLimit(
        canvas,
        encoder,
        WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES,
        'image/webp',
      );
      return { base64: webp.base64, sizeBytes: webp.sizeBytes, width: size, height: size, format: 'image/webp' };
    }
    throw new AppError(
      'IMAGE_TOO_LARGE',
      'O ícone do pacote ficou maior que 50 KB. Escolha uma imagem mais simples.',
    );
  } finally {
    disposeCanvas(canvas);
  }
}


export async function createThumbnailDataUrl(
  source: HTMLCanvasElement,
  size: number,
  options: { encoder?: ImageEncoder; factory?: CanvasFactory } = {},
): Promise<string> {
  const encoder = options.encoder ?? createBrowserImageEncoder();
  const factory = options.factory ?? defaultCanvasFactory;
  const { canvas, ctx } = createSurface(size, size, factory);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source, 0, 0, size, size);
  try {
    const encoded = await encoder.encode(canvas, 'image/webp', 0.75);
    return base64ToDataUrl(encoded.base64, 'image/webp');
  } catch {
    const png = await encoder.encode(canvas, 'image/png', 1);
    return base64ToDataUrl(png.base64, 'image/png');
  } finally {
    disposeCanvas(canvas);
  }
}


export async function renderStickerThumbnailDataUrl(
  request: StickerRenderRequest,
  size: number,
  options: { encoder?: ImageEncoder; factory?: CanvasFactory } = {},
): Promise<string> {
  const canvas = renderStickerToCanvas(request.elements, {
    resources: request.resources,
    canvasSize: EDITOR_CONFIG.canvasSize,
    scale: 1,
    factory: options.factory,
  });
  try {
    return await createThumbnailDataUrl(canvas, size, options);
  } finally {
    disposeCanvas(canvas);
  }
}


export function composeFittedSquare(
  source: CanvasImageSource & { width: number; height: number },
  options: { size?: number; fillRatio?: number; factory?: CanvasFactory } = {},
): HTMLCanvasElement {
  const size = options.size ?? WHATSAPP_LIMITS.STICKER_DIMENSION;
  const ratio = options.fillRatio ?? 0.94;
  const factory = options.factory ?? defaultCanvasFactory;
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const fitted = fitInsideBox(sourceWidth, sourceHeight, size, ratio);
  const position = centerInCanvas(fitted.width, fitted.height, size);
  const canvas = factory(size, size);
  const ctx = getContext2D(canvas, { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, position.x, position.y, fitted.width, fitted.height);
  return canvas;
}


export async function exportStickerFromDataUrl(
  dataUrl: string,
  options: ExportStickerOptions & { fillRatio?: number } = {},
): Promise<ExportedStickerArtwork> {
  const dimension = options.targetDimension ?? WHATSAPP_LIMITS.STICKER_DIMENSION;
  const encoder = options.encoder ?? createBrowserImageEncoder();
  if (!encoder.supports('image/webp')) {
    throw new AppError('WEBP_UNSUPPORTED', 'Este WebView não consegue gerar arquivos WebP.');
  }
  const image = await loadImageElement(dataUrl);
  const canvas = composeFittedSquare(image, {
    size: dimension,
    fillRatio: options.fillRatio,
    factory: options.factory,
  });
  try {
    const result = await encodeWithinLimit(
      canvas,
      encoder,
      options.maxBytes ?? WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES,
    );
    return {
      base64: result.base64,
      sizeBytes: result.sizeBytes,
      width: dimension,
      height: dimension,
      quality: result.quality,
      mimeType: 'image/webp',
      warnings: [],
    };
  } finally {
    disposeCanvas(canvas);
  }
}

export function artworkByteSize(base64: string): number {
  return base64ByteSize(base64);
}


export async function exportAnimatedStickerFromGifDataUrl(
  dataUrl: string,
  options: { maxBytes?: number; maxFrames?: number } = {},
): Promise<ExportedStickerArtwork & { isAnimated: boolean; durationMs: number }> {
  const { dataUrlToUint8Array, decodeGif } = await import('./gifDecoder');
  const { encodeAnimatedWebp } = await import('./animatedWebpEncoder');

  const bytes = await dataUrlToUint8Array(dataUrl);
  const decoded = decodeGif(bytes, { maxFrames: options.maxFrames ?? 50 });

  const dimension = WHATSAPP_LIMITS.STICKER_DIMENSION;
  const fittedFrames = decoded.frames.map((frame) => {
    const canvas = composeFittedSquare(frame.canvas, { size: dimension, fillRatio: 0.94 });
    return {
      canvas,
      delayMs: frame.delayMs,
    };
  });

  try {
    const encoded = await encodeAnimatedWebp(fittedFrames, {
      width: dimension,
      height: dimension,
      maxBytes: options.maxBytes ?? WHATSAPP_LIMITS.ANIMATED_STICKER_MAX_BYTES,
    });

    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < encoded.uint8Array.length; i += chunk) {
      binary += String.fromCharCode(...encoded.uint8Array.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return {
      base64,
      sizeBytes: encoded.sizeBytes,
      width: dimension,
      height: dimension,
      quality: 0.8,
      mimeType: 'image/webp',
      warnings: [],
      isAnimated: true,
      durationMs: encoded.durationMs,
    };
  } finally {
    for (const f of fittedFrames) {
      disposeCanvas(f.canvas);
    }
  }
}

function collectWarnings(elements: readonly EditorElement[]): string[] {
  const warnings: string[] = [];
  const hasOutline = elements.some((element) => {
    if (element.kind === 'drawing') return false;
    return element.stroke.enabled && element.stroke.width > 0;
  });
  if (!hasOutline) {
    warnings.push(
      `Dica: adicione um contorno branco de ${WHATSAPP_LIMITS.RECOMMENDED_STROKE_WIDTH}px na imagem para a figurinha ficar legível em fundos claros.`,
    );
  }
  const hasDrawingLayer = elements.some((element) => element.kind === 'drawing' && element.strokes.length > 0);
  if (hasDrawingLayer) {
    warnings.push('Os traços de desenho fazem parte da figurinha exportada.');
  }
  return warnings;
}
