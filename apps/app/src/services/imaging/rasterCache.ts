import { EDITOR_CONFIG } from '@/config/editor';
import type { DrawingElement, ImageElement, TextElement } from '@/domain/editor/elements';
import { drawingRevision } from '@/domain/editor/drawing';
import { maskRevision } from '@/domain/editor/mask';
import { hashObject } from '@/shared/utils/hash';
import type { AssetImageStore } from './assetImageStore';
import { disposeCanvas, type CanvasFactory, defaultCanvasFactory } from './canvas';
import { rasterizeDrawing } from './drawingRaster';
import { rasterizeImage } from './imageRaster';
import { rasterizeText, textRevision, type TextRasterInput } from './textRaster';


export interface RasterEntry {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}


export interface RasterResources {
  getImageRaster(element: ImageElement): RasterEntry | null;
  getTextRaster(element: TextElement): RasterEntry | null;
  getDrawingRaster(element: DrawingElement): RasterEntry | null;
}

export interface EditorRasterCacheOptions {
  scale?: number;
  factory?: CanvasFactory;
  maxEntries?: number;
}


export class EditorRasterCache implements RasterResources {
  private readonly entries = new Map<string, RasterEntry>();

  private readonly scale: number;

  private readonly factory: CanvasFactory;

  private readonly maxEntries: number;

  constructor(
    private readonly assets: AssetImageStore,
    options: EditorRasterCacheOptions = {},
  ) {
    this.scale = options.scale ?? EDITOR_CONFIG.rasterScale;
    this.factory = options.factory ?? defaultCanvasFactory;
    this.maxEntries = options.maxEntries ?? 24;
  }

  getImageRaster(element: ImageElement): RasterEntry | null {
    const source = this.assets.get(element.assetPath);
    if (!source) return null;
    const filtersKey = element.filters
      ? `${element.filters.brightness}:${element.filters.contrast}:${element.filters.saturation}:${element.filters.grayscale ? 1 : 0}:${element.filters.sepia ? 1 : 0}:${element.filters.invert ? 1 : 0}`
      : 'no-filter';
    const key = [
      'img',
      element.assetPath,
      `${Math.round(element.width)}x${Math.round(element.height)}`,
      maskRevision(element.maskStrokes),
      element.stroke.enabled ? `${element.stroke.color}:${element.stroke.width}` : 'no-stroke',
      filtersKey,
      this.scale,
    ].join('|');
    return this.resolve(key, () => ({
      canvas: rasterizeImage(
        {
          source,
          width: element.width,
          height: element.height,
          maskStrokes: element.maskStrokes,
          stroke: element.stroke,
          filters: element.filters,
        },
        { scale: this.scale, factory: this.factory },
      ),
      width: element.width,
      height: element.height,
    }));
  }

  getTextRaster(element: TextElement): RasterEntry | null {
    const input: TextRasterInput = {
      text: element.text,
      fontId: element.fontId,
      fontSize: element.fontSize,
      color: element.color,
      align: element.align,
      lineHeight: element.lineHeight,
      stroke: element.stroke,
      shadow: element.shadow,
    };
    const key = `txt|${textRevision(input, this.scale)}`;
    return this.resolve(key, () => {
      const raster = rasterizeText(input, { scale: this.scale, factory: this.factory });
      return { canvas: raster.canvas, width: raster.width, height: raster.height };
    });
  }

  getDrawingRaster(element: DrawingElement): RasterEntry | null {
    const key = `drw|${drawingRevision(element.strokes)}|${this.scale}`;
    return this.resolve(key, () => ({
      canvas: rasterizeDrawing(element.strokes, { scale: this.scale, factory: this.factory }),
      width: EDITOR_CONFIG.canvasSize,
      height: EDITOR_CONFIG.canvasSize,
    }));
  }

  
  invalidateByPrefix(prefix: string): void {
    for (const [key, entry] of [...this.entries.entries()]) {
      if (key.startsWith(prefix)) {
        disposeCanvas(entry.canvas);
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) disposeCanvas(entry.canvas);
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  revisionSignature(elements: readonly (ImageElement | TextElement | DrawingElement)[]): string {
    return hashObject(
      elements.map((element) => {
        if (element.kind === 'image') return maskRevision(element.maskStrokes);
        if (element.kind === 'drawing') return drawingRevision(element.strokes);
        return textRevision(
          {
            text: element.text,
            fontId: element.fontId,
            fontSize: element.fontSize,
            color: element.color,
            align: element.align,
            lineHeight: element.lineHeight,
            stroke: element.stroke,
            shadow: element.shadow,
          },
          this.scale,
        );
      }),
    );
  }

  private resolve(key: string, create: () => RasterEntry): RasterEntry {
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }
    const entry = create();
    this.entries.set(key, entry);
    this.trim();
    return entry;
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const entry = this.entries.get(oldestKey);
      if (entry) disposeCanvas(entry.canvas);
      this.entries.delete(oldestKey);
    }
  }
}
