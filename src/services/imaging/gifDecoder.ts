import { GifReader } from 'omggif';
import { AppError } from '@/shared/errors';

export interface DecodedGifFrame {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

export interface DecodedGif {
  width: number;
  height: number;
  durationMs: number;
  frameCount: number;
  isAnimated: boolean;
  frames: DecodedGifFrame[];
}

export function isGifBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const b0 = bytes[0] ?? 0;
  const b1 = bytes[1] ?? 0;
  const b2 = bytes[2] ?? 0;
  const b3 = bytes[3] ?? 0;
  const b4 = bytes[4] ?? 0;
  const b5 = bytes[5] ?? 0;
  const header = String.fromCharCode(b0, b1, b2, b3, b4, b5);
  return header === 'GIF89a' || header === 'GIF87a';
}

export async function dataUrlToUint8Array(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

export function decodeGif(
  bytes: Uint8Array,
  options: { maxFrames?: number; maxDurationMs?: number } = {},
): DecodedGif {
  const maxFrames = options.maxFrames ?? 60;
  const maxDurationMs = options.maxDurationMs ?? 6000;

  let reader: GifReader;
  try {
    reader = new GifReader(bytes as unknown as Buffer);
  } catch (err) {
    throw new AppError('IMAGE_DECODE_FAILED', 'O arquivo GIF está corrompido ou em formato inválido.', {
      cause: err,
    });
  }

  const rawFrameCount = reader.numFrames();
  const width = reader.width;
  const height = reader.height;

  if (width <= 0 || height <= 0 || rawFrameCount <= 0) {
    throw new AppError('IMAGE_DECODE_FAILED', 'Dimensões do GIF inválidas.');
  }

  const isAnimated = rawFrameCount > 1;

  let step = 1;
  if (rawFrameCount > maxFrames) {
    step = Math.ceil(rawFrameCount / maxFrames);
  }

  const frames: DecodedGifFrame[] = [];
  let totalDurationMs = 0;

  const compositingCanvas = document.createElement('canvas');
  compositingCanvas.width = width;
  compositingCanvas.height = height;
  const compCtx = compositingCanvas.getContext('2d', { willReadFrequently: true });
  if (!compCtx) {
    throw new AppError('IMAGE_DECODE_FAILED', 'Não foi possível inicializar o contexto 2D para o GIF.');
  }

  let backupImageData: ImageData | null = null;

  for (let i = 0; i < rawFrameCount; i++) {
    const info = reader.frameInfo(i);
    let delayMs = (info.delay || 10) * 10;
    if (delayMs < 20) delayMs = 100;

    if (info.disposal === 3) {
      backupImageData = compCtx.getImageData(0, 0, width, height);
    }

    const pixelBuffer = new Uint8Array(width * height * 4);
    reader.decodeAndBlitFrameRGBA(i, pixelBuffer);

    const frameImageData = new ImageData(
      new Uint8ClampedArray(pixelBuffer.buffer),
      width,
      height,
    );

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(frameImageData, 0, 0);
      compCtx.drawImage(tempCanvas, 0, 0);
    }

    if (i % step === 0 && totalDurationMs < maxDurationMs) {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outCtx = outputCanvas.getContext('2d');
      if (outCtx) {
        outCtx.drawImage(compositingCanvas, 0, 0);
        frames.push({
          canvas: outputCanvas,
          delayMs: delayMs * step,
        });
        totalDurationMs += delayMs * step;
      }
    }

    if (info.disposal === 2) {
      compCtx.clearRect(info.x, info.y, info.width, info.height);
    } else if (info.disposal === 3 && backupImageData) {
      compCtx.putImageData(backupImageData, 0, 0);
    }
  }

  if (frames.length === 0) {
    const single = document.createElement('canvas');
    single.width = width;
    single.height = height;
    const sCtx = single.getContext('2d');
    if (sCtx) sCtx.drawImage(compositingCanvas, 0, 0);
    frames.push({ canvas: single, delayMs: 100 });
    totalDurationMs = 100;
  }

  return {
    width,
    height,
    durationMs: totalDurationMs,
    frameCount: frames.length,
    isAnimated,
    frames,
  };
}
