import { describe, expect, it } from 'vitest';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { createImageElement, createDrawingElement, type EditorElement } from '@/domain/editor/elements';
import { createStroke } from '@/domain/editor/drawing';
import { AppError } from '@/shared/errors';
import type { CanvasFactory } from './canvas';
import type { EncodeFormat, EncodedImage, ImageEncoder } from './encoder';
import type { RasterEntry, RasterResources } from './rasterCache';
import {
  exportStickerArtwork,
  exportTrayIconFromCanvas,
  encodeWithinLimit,
} from './exportSticker';


function createMockContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    clearRect: noop,
    scale: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    drawImage: noop,
  } as unknown as CanvasRenderingContext2D;
}

function createFakeCanvas(width: number, height: number): HTMLCanvasElement {
  const ctx = createMockContext();
  return {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

const factory: CanvasFactory = (width, height) =>
  createFakeCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));

function fakeEncoder(sizeFor: (quality: number, format: EncodeFormat) => number): ImageEncoder {
  return {
    supports: () => true,
    async encode(canvas, format, quality): Promise<EncodedImage> {
      return {
        base64: 'ZmFrZQ==',
        mimeType: format,
        sizeBytes: sizeFor(quality, format),
        quality,
        width: canvas.width,
        height: canvas.height,
      };
    },
  };
}

function fakeResources(element: EditorElement): RasterResources {
  const entry: RasterEntry = { canvas: createFakeCanvas(512, 512), width: 512, height: 512 };
  return {
    getImageRaster: () => (element.kind === 'image' ? entry : null),
    getTextRaster: () => null,
    getDrawingRaster: () => entry,
  };
}

function imageElement(): EditorElement {
  return createImageElement({
    assetPath: 'projects/p/assets/a.png',
    naturalWidth: 512,
    naturalHeight: 512,
    x: 0,
    y: 0,
    width: 512,
    height: 512,
  });
}


describe('exportStickerArtwork', () => {
  it('gera WebP 512x512 reduzindo a qualidade até caber no limite', async () => {
    const element = imageElement();
    const result = await exportStickerArtwork(
      { elements: [element], resources: fakeResources(element) },
      { factory, encoder: fakeEncoder((quality) => Math.round(quality * 200_000)) },
    );

    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.sizeBytes).toBeLessThanOrEqual(WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES);
    expect(result.quality).toBeLessThanOrEqual(0.95);
  });

  it('lança STICKER_TOO_LARGE quando nem a menor qualidade cabe', async () => {
    const element = imageElement();
    await expect(
      exportStickerArtwork(
        { elements: [element], resources: fakeResources(element) },
        { factory, encoder: fakeEncoder(() => 400_000) },
      ),
    ).rejects.toMatchObject({ code: 'STICKER_TOO_LARGE' });
  });

  it('recusa exportar um canvas vazio', async () => {
    await expect(
      exportStickerArtwork({ elements: [], resources: fakeResources(imageElement()) }, { factory }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('avisa quando o dispositivo não suporta WebP', async () => {
    const element = imageElement();
    const encoder: ImageEncoder = { supports: () => false, encode: fakeEncoder(() => 1000).encode };
    await expect(
      exportStickerArtwork({ elements: [element], resources: fakeResources(element) }, { factory, encoder }),
    ).rejects.toMatchObject({ code: 'WEBP_UNSUPPORTED' });
  });

  it('sugere contorno quando nenhum elemento tem contorno', async () => {
    const element = imageElement();
    const result = await exportStickerArtwork(
      { elements: [element], resources: fakeResources(element) },
      { factory, encoder: fakeEncoder(() => 10_000) },
    );
    expect(result.warnings.join(' ')).toContain('contorno');
  });

  it('avisa que os traços de desenho entram na figurinha', async () => {
    const drawing: EditorElement = {
      ...createDrawingElement(),
      strokes: [createStroke('paint', '#FFFFFF', 8, [10, 10])],
    };
    const result = await exportStickerArtwork(
      { elements: [drawing], resources: fakeResources(drawing) },
      { factory, encoder: fakeEncoder(() => 10_000) },
    );
    expect(result.warnings.join(' ')).toContain('desenho');
  });
});

describe('encodeWithinLimit', () => {
  it('devolve a primeira qualidade que respeita o limite', async () => {
    const canvas = createFakeCanvas(512, 512);
    const result = await encodeWithinLimit(canvas, fakeEncoder(() => 1000), 1024);
    expect(result.quality).toBe(0.95);
    expect(result.sizeBytes).toBe(1000);
  });

  it('lança AppError quando o limite não pode ser atingido', async () => {
    const canvas = createFakeCanvas(512, 512);
    await expect(encodeWithinLimit(canvas, fakeEncoder(() => 99999), 100)).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('exportTrayIconFromCanvas', () => {
  it('gera PNG 96x96 quando o arquivo cabe em 50 KB', async () => {
    const tray = await exportTrayIconFromCanvas(createFakeCanvas(512, 512), {
      factory,
      encoder: fakeEncoder(() => 20 * 1024),
    });
    expect(tray.width).toBe(96);
    expect(tray.height).toBe(96);
    expect(tray.format).toBe('image/png');
    expect(tray.sizeBytes).toBeLessThanOrEqual(WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES);
  });

  it('recodifica em WebP quando o PNG passa do limite', async () => {
    const tray = await exportTrayIconFromCanvas(createFakeCanvas(512, 512), {
      factory,
      encoder: fakeEncoder((_quality, format) => (format === 'image/png' ? 80 * 1024 : 30 * 1024)),
    });
    expect(tray.format).toBe('image/webp');
  });
});
