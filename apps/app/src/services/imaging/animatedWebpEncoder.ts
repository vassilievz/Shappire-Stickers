import { AppError } from '@/shared/errors';
import { clamp } from '@/shared/utils/math';

export interface FrameInput {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

export interface AnimatedWebpResult {
  blob: Blob;
  uint8Array: Uint8Array;
  sizeBytes: number;
  frameCount: number;
  durationMs: number;
}

async function canvasToWebpBuffer(canvas: HTMLCanvasElement, quality = 0.8): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality);
  });
  if (!blob) {
    throw new AppError('IMAGE_ENCODE_FAILED', 'Falha ao codificar quadro para WebP.');
  }
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

function writeUint24LE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
  arr[offset + 2] = (value >> 16) & 0xff;
}

function writeUint32LE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
  arr[offset + 2] = (value >> 16) & 0xff;
  arr[offset + 3] = (value >> 24) & 0xff;
}

function writeUint16LE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
}

function writeString(arr: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    arr[offset + i] = str.charCodeAt(i);
  }
}

function extractFrameSubchunks(webpBytes: Uint8Array): Uint8Array {
  if (webpBytes.length < 12) return new Uint8Array(0);
  const riff = String.fromCharCode(...webpBytes.slice(0, 4));
  const webp = String.fromCharCode(...webpBytes.slice(8, 12));
  if (riff !== 'RIFF' || webp !== 'WEBP') return new Uint8Array(0);

  const subchunks: Uint8Array[] = [];
  let offset = 12;

  while (offset + 8 <= webpBytes.length) {
    const fourCC = String.fromCharCode(...webpBytes.slice(offset, offset + 4));
    const size =
      (webpBytes[offset + 4] ?? 0) |
      ((webpBytes[offset + 5] ?? 0) << 8) |
      ((webpBytes[offset + 6] ?? 0) << 16) |
      ((webpBytes[offset + 7] ?? 0) << 24);

    const paddedSize = size + (size % 2);
    const chunkTotalLength = 8 + paddedSize;

    if (offset + chunkTotalLength > webpBytes.length) {
      break;
    }

    if (fourCC === 'VP8L' || fourCC === 'VP8 ' || fourCC === 'ALPH') {
      subchunks.push(webpBytes.slice(offset, offset + chunkTotalLength));
    }

    offset += chunkTotalLength;
  }

  const totalLength = subchunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of subchunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

export async function encodeAnimatedWebp(
  frames: FrameInput[],
  options: {
    width?: number;
    height?: number;
    initialQuality?: number;
    maxBytes?: number;
  } = {},
): Promise<AnimatedWebpResult> {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const maxBytes = options.maxBytes ?? 500 * 1024;
  let quality = options.initialQuality ?? 0.8;

  if (frames.length === 0) {
    throw new AppError('IMAGE_ENCODE_FAILED', 'Nenhum quadro para animar.');
  }

  let candidate: Uint8Array | null = null;
  let attempts = 0;
  let activeFrames = [...frames];

  while (attempts < 3) {
    attempts++;

    const encodedFrames = await Promise.all(
      activeFrames.map(async (frame) => {
        const webp = await canvasToWebpBuffer(frame.canvas, quality);
        const subchunks = extractFrameSubchunks(webp);
        return {
          delayMs: frame.delayMs,
          subchunks,
        };
      }),
    );

    let totalAnmfLength = 0;
    const anmfChunks: Uint8Array[] = [];

    for (const frame of encodedFrames) {
      const anmfPayloadSize = 16 + frame.subchunks.length;
      const anmfPadding = anmfPayloadSize % 2;
      const anmfTotalSize = 8 + anmfPayloadSize + anmfPadding;

      const anmf = new Uint8Array(anmfTotalSize);
      writeString(anmf, 0, 'ANMF');
      writeUint32LE(anmf, 4, anmfPayloadSize);

      writeUint24LE(anmf, 8, 0);
      writeUint24LE(anmf, 11, 0);
      writeUint24LE(anmf, 14, width - 1);
      writeUint24LE(anmf, 17, height - 1);
      writeUint24LE(anmf, 20, clamp(frame.delayMs, 10, 16777215));

      anmf[23] = 0x03;

      anmf.set(frame.subchunks, 24);

      if (anmfPadding > 0) {
        anmf[anmfTotalSize - 1] = 0;
      }

      anmfChunks.push(anmf);
      totalAnmfLength += anmfTotalSize;
    }

    const vp8xLength = 8 + 10;
    const animLength = 8 + 6;
    const totalFileSize = 12 + vp8xLength + animLength + totalAnmfLength;

    const file = new Uint8Array(totalFileSize);

    writeString(file, 0, 'RIFF');
    writeUint32LE(file, 4, totalFileSize - 8);
    writeString(file, 8, 'WEBP');

    writeString(file, 12, 'VP8X');
    writeUint32LE(file, 16, 10);
    file[20] = 0x12;
    file[21] = 0;
    file[22] = 0;
    file[23] = 0;
    writeUint24LE(file, 24, width - 1);
    writeUint24LE(file, 27, height - 1);

    writeString(file, 30, 'ANIM');
    writeUint32LE(file, 34, 6);
    writeUint32LE(file, 38, 0);
    writeUint16LE(file, 42, 0);

    let currentPos = 44;
    for (const anmf of anmfChunks) {
      file.set(anmf, currentPos);
      currentPos += anmf.length;
    }

    candidate = file;

    if (file.length <= maxBytes) {
      break;
    }

    quality = Math.max(0.4, quality * 0.7);
    if (activeFrames.length > 20) {
      activeFrames = activeFrames.filter((_, idx) => idx % 2 === 0);
    }
  }

  if (!candidate) {
    throw new AppError('IMAGE_ENCODE_FAILED', 'Falha ao gerar arquivo WebP animado.');
  }

  const durationMs = activeFrames.reduce((sum, f) => sum + f.delayMs, 0);
  const blob = new Blob([candidate as unknown as BlobPart], { type: 'image/webp' });

  return {
    blob,
    uint8Array: candidate,
    sizeBytes: candidate.length,
    frameCount: activeFrames.length,
    durationMs,
  };
}
