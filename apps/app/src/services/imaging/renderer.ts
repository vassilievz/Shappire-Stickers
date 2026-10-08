import { EDITOR_CONFIG } from '@/config/editor';
import { isTransformable, type EditorElement, type TextElement } from '@/domain/editor/elements';
import { degToRad } from '@/shared/utils/math';
import { type CanvasFactory, defaultCanvasFactory, createSurface } from './canvas';
import { textFontString } from './textRaster';
import type { RasterResources } from './rasterCache';


export interface RenderStickerOptions {
  resources: RasterResources;
  canvasSize?: number;
  scale?: number;
  factory?: CanvasFactory;
  
  hiddenElementIds?: ReadonlySet<string>;
}

export interface ElementTransform {
  centerX: number;
  centerY: number;
  rotation: number;
  width: number;
  height: number;
  opacity: number;
}

export function elementTransform(element: EditorElement): ElementTransform {
  if (!isTransformable(element)) {
    const half = EDITOR_CONFIG.canvasSize / 2;
    return { centerX: half, centerY: half, rotation: 0, width: EDITOR_CONFIG.canvasSize, height: EDITOR_CONFIG.canvasSize, opacity: 1 };
  }
  return {
    centerX: element.x + element.width / 2,
    centerY: element.y + element.height / 2,
    rotation: element.rotation,
    width: element.width,
    height: element.height,
    opacity: element.opacity,
  };
}


export function renderElementsToContext(
  ctx: CanvasRenderingContext2D,
  elements: readonly EditorElement[],
  options: RenderStickerOptions,
): void {
  const hidden = options.hiddenElementIds;

  for (const element of elements) {
    if (!element.visible) continue;
    if (hidden?.has(element.id)) continue;

    if (element.kind === 'image') {
      const raster = options.resources.getImageRaster(element);
      if (!raster) continue;
      drawTransformed(ctx, raster.canvas, elementTransform(element));
      continue;
    }

    if (element.kind === 'text') {
      const raster = options.resources.getTextRaster(element);
      if (!raster) continue;
      drawTransformed(ctx, raster.canvas, {
        ...elementTransform(element),
        width: raster.width,
        height: raster.height,
      });
      continue;
    }

    const raster = options.resources.getDrawingRaster(element);
    if (!raster) continue;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(raster.canvas, 0, 0, options.canvasSize ?? EDITOR_CONFIG.canvasSize, options.canvasSize ?? EDITOR_CONFIG.canvasSize);
    ctx.restore();
  }
}


export function drawTransformed(
  ctx: CanvasRenderingContext2D,
  raster: CanvasImageSource,
  transform: ElementTransform,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  ctx.translate(transform.centerX, transform.centerY);
  if (transform.rotation !== 0) {
    ctx.rotate(degToRad(transform.rotation));
  }
  ctx.drawImage(raster, -transform.width / 2, -transform.height / 2, transform.width, transform.height);
  ctx.restore();
}


export function renderStickerToCanvas(
  elements: readonly EditorElement[],
  options: RenderStickerOptions,
): HTMLCanvasElement {
  const canvasSize = options.canvasSize ?? EDITOR_CONFIG.canvasSize;
  const scale = options.scale ?? 1;
  const factory = options.factory ?? defaultCanvasFactory;
  const { canvas, ctx } = createSurface(Math.round(canvasSize * scale), Math.round(canvasSize * scale), factory);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  renderElementsToContext(ctx, elements, { ...options, canvasSize, scale });
  return canvas;
}

export interface MeasuredText {
  width: number;
  height: number;
}


export function measureTextElementForLayout(
  element: Pick<TextElement, 'text' | 'fontId' | 'fontSize' | 'lineHeight' | 'stroke' | 'shadow' | 'align'>,
  resources: RasterResources,
  fallback: MeasuredText = { width: 40, height: 40 },
): MeasuredText {
  const raster = resources.getTextRaster({ ...element, id: 'measure' } as TextElement);
  if (!raster) return fallback;
  return { width: raster.width, height: raster.height };
}


export function konvaFontString(element: Pick<TextElement, 'fontId' | 'fontSize'>): string {
  return textFontString(element);
}
