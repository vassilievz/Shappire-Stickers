import { AppError } from '@/shared/errors';


export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export const defaultCanvasFactory: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export interface CanvasSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}


export function getContext2D(
  canvas: HTMLCanvasElement,
  options: { willReadFrequently?: boolean } = {},
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', {
    willReadFrequently: options.willReadFrequently ?? false,
  }) as CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new AppError('IMAGE_DECODE_FAILED', 'Não foi possível inicializar o canvas 2D neste dispositivo.');
  }
  return ctx;
}

export function createSurface(width: number, height: number, factory: CanvasFactory = defaultCanvasFactory): CanvasSurface {
  const canvas = factory(width, height);
  const ctx = getContext2D(canvas, { willReadFrequently: true });
  return { canvas, ctx };
}

export function createCanvas(width: number, height: number, factory: CanvasFactory = defaultCanvasFactory): HTMLCanvasElement {
  return factory(width, height);
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = getContext2D(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}


export function disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

export function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export function dataUrlMimeType(dataUrl: string): string {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match?.[1] ?? 'image/png';
}

export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}


export function base64ByteSize(base64: string): number {
  const clean = base64.replace(/[\r\n\s]/g, '');
  if (clean === '') return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): string {
  try {
    return quality === undefined ? canvas.toDataURL(type) : canvas.toDataURL(type, quality);
  } catch (error) {
    throw new AppError('IMAGE_ENCODE_FAILED', 'Falha ao converter o canvas em imagem.', { cause: error });
  }
}
