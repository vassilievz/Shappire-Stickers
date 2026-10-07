import { EDITOR_CONFIG } from '@/config/editor';
import type { ImageFilters, MaskStroke, StrokeStyle } from '@/domain/editor/elements';
import { hasMask } from '@/domain/editor/mask';
import { type CanvasFactory, defaultCanvasFactory, getContext2D } from './canvas';

export interface ImageRasterInput {
  source: CanvasImageSource & { width: number; height: number };
  
  width: number;
  height: number;
  maskStrokes: readonly MaskStroke[];
  stroke: StrokeStyle;
  filters?: ImageFilters;
}

export function buildCanvasFilterString(filters?: Partial<ImageFilters>): string {
  if (!filters) return 'none';
  const parts: string[] = [];
  if (filters.brightness !== undefined && filters.brightness !== 0) {
    parts.push(`brightness(${100 + filters.brightness}%)`);
  }
  if (filters.contrast !== undefined && filters.contrast !== 0) {
    parts.push(`contrast(${100 + filters.contrast}%)`);
  }
  if (filters.saturation !== undefined && filters.saturation !== 0) {
    parts.push(`saturate(${100 + filters.saturation}%)`);
  }
  if (filters.grayscale) {
    parts.push('grayscale(100%)');
  }
  if (filters.sepia) {
    parts.push('sepia(100%)');
  }
  if (filters.invert) {
    parts.push('invert(100%)');
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export interface RasterizeImageOptions {
  scale?: number;
  factory?: CanvasFactory;
}


export function rasterizeImage(
  input: ImageRasterInput,
  options: RasterizeImageOptions = {},
): HTMLCanvasElement {
  const scale = options.scale ?? EDITOR_CONFIG.rasterScale;
  const factory = options.factory ?? defaultCanvasFactory;
  const pixelWidth = Math.max(1, Math.round(input.width * scale));
  const pixelHeight = Math.max(1, Math.round(input.height * scale));

  const canvas = factory(pixelWidth, pixelHeight);
  const ctx = getContext2D(canvas, { willReadFrequently: true });
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const filterString = buildCanvasFilterString(input.filters);
  if (filterString !== 'none') {
    ctx.filter = filterString;
  }
  ctx.drawImage(input.source, 0, 0, pixelWidth, pixelHeight);
  if (filterString !== 'none') {
    ctx.filter = 'none';
  }

  if (hasMask(input.maskStrokes)) {
    applyMaskPath(ctx, input.maskStrokes, pixelWidth, pixelHeight, scale);
  }

  if (input.stroke.enabled && input.stroke.width > 0) {
    return applyOutline(canvas, input.stroke.color, input.stroke.width, scale, factory);
  }
  return canvas;
}


export function applyMaskPath(
  ctx: CanvasRenderingContext2D,
  strokes: readonly MaskStroke[],
  pixelWidth: number,
  pixelHeight: number,
  scale: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  for (const stroke of strokes) {
    const radius = (stroke.brushSize / 2) * scale;
    ctx.lineWidth = Math.max(1, stroke.brushSize * scale);
    const points = stroke.points;
    if (points.length === 2) {
      const nx = points[0];
      const ny = points[1];
      if (nx !== undefined && ny !== undefined) {
        ctx.beginPath();
        ctx.arc(nx * pixelWidth, ny * pixelHeight, Math.max(1, radius), 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.beginPath();
    let started = false;
    for (let i = 0; i + 1 < points.length; i += 2) {
      const nx = points[i];
      const ny = points[i + 1];
      if (nx === undefined || ny === undefined) break;
      const x = nx * pixelWidth;
      const y = ny * pixelHeight;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (started) ctx.stroke();
  }
  ctx.restore();
}


export function applyOutline(
  base: HTMLCanvasElement,
  color: string,
  strokeWidth: number,
  scale: number,
  factory: CanvasFactory = defaultCanvasFactory,
): HTMLCanvasElement {
  const thickness = Math.max(1, Math.round(strokeWidth * scale));
  const width = base.width;
  const height = base.height;

  const silhouette = factory(width, height);
  const silhouetteCtx = getContext2D(silhouette, { willReadFrequently: true });
  silhouetteCtx.clearRect(0, 0, width, height);
  silhouetteCtx.drawImage(base, 0, 0);
  silhouetteCtx.globalCompositeOperation = 'source-in';
  silhouetteCtx.fillStyle = color;
  silhouetteCtx.fillRect(0, 0, width, height);

  const outlined = factory(width, height);
  const ctx = getContext2D(outlined, { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  const steps = 16;
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ctx.drawImage(silhouette, Math.cos(angle) * thickness, Math.sin(angle) * thickness);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(base, 0, 0);
  return outlined;
}
