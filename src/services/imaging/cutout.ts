import { createSurface } from './canvas';

export interface RemoveColorOptions {
  targetR: number;
  targetG: number;
  targetB: number;
  /** Tolerance from 0 (exact match) to 1 (all colors) - default 0.25 */
  tolerance?: number;
  /** If true, only removes color connected to startX, startY; if false, removes everywhere */
  contiguous?: boolean;
  startX?: number;
  startY?: number;
  /** Soft edge factor (0 to 0.5) */
  edgeSoftness?: number;
}

const MAX_RGB_DISTANCE = Math.sqrt(255 * 255 * 3); // ~441.67

/**
 * Removes target color from an ImageData object, creating transparency.
 * Supports contiguous (flood-fill) and global modes with adjustable tolerance.
 */
export function removeColorFromImageData(
  imageData: ImageData,
  options: RemoveColorOptions,
): ImageData {
  const {
    targetR,
    targetG,
    targetB,
    tolerance = 0.25,
    contiguous = true,
    startX = 0,
    startY = 0,
    edgeSoftness = 0.1,
  } = options;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;

  const threshold = Math.max(0, Math.min(1, tolerance));
  const innerThreshold = threshold * Math.max(0, 1 - edgeSoftness);

  const getDistance = (offset: number): number => {
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const a = data[offset + 3] ?? 0;
    if (a === 0) return 1.0; // Already transparent
    const dr = r - targetR;
    const dg = g - targetG;
    const db = b - targetB;
    return Math.sqrt(dr * dr + dg * dg + db * db) / MAX_RGB_DISTANCE;
  };

  const applyTransparency = (offset: number, dist: number): void => {
    const currentAlpha = data[offset + 3] ?? 0;
    if (currentAlpha === 0) return;

    if (dist <= innerThreshold) {
      data[offset + 3] = 0;
    } else if (dist <= threshold && innerThreshold < threshold) {
      const factor = (dist - innerThreshold) / (threshold - innerThreshold);
      data[offset + 3] = Math.round(currentAlpha * factor);
    }
  };

  if (!contiguous) {
    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      const dist = getDistance(offset);
      if (dist <= threshold) {
        applyTransparency(offset, dist);
      }
    }
    return imageData;
  }

  // Contiguous flood-fill using queue (BFS)
  const initialX = Math.max(0, Math.min(width - 1, Math.round(startX)));
  const initialY = Math.max(0, Math.min(height - 1, Math.round(startY)));
  const startIndex = initialY * width + initialX;

  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let queueHead = 0;
  let queueTail = 0;

  queue[queueTail++] = startIndex;
  visited[startIndex] = 1;

  while (queueHead < queueTail) {
    const idx = queue[queueHead++] ?? 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const offset = idx * 4;

    const dist = getDistance(offset);
    if (dist <= threshold) {
      applyTransparency(offset, dist);

      // Explore 4-neighbors
      if (x > 0) {
        const nextIdx = idx - 1;
        if (!visited[nextIdx]) {
          visited[nextIdx] = 1;
          queue[queueTail++] = nextIdx;
        }
      }
      if (x < width - 1) {
        const nextIdx = idx + 1;
        if (!visited[nextIdx]) {
          visited[nextIdx] = 1;
          queue[queueTail++] = nextIdx;
        }
      }
      if (y > 0) {
        const nextIdx = idx - width;
        if (!visited[nextIdx]) {
          visited[nextIdx] = 1;
          queue[queueTail++] = nextIdx;
        }
      }
      if (y < height - 1) {
        const nextIdx = idx + width;
        if (!visited[nextIdx]) {
          visited[nextIdx] = 1;
          queue[queueTail++] = nextIdx;
        }
      }
    }
  }

  return imageData;
}

/**
 * Crops a canvas by a closed polygon path (Lasso tool). Everything outside the path becomes transparent.
 */
export function cropCanvasWithPolygon(
  sourceCanvas: HTMLCanvasElement,
  points: ReadonlyArray<{ x: number; y: number }>,
): HTMLCanvasElement {
  if (points.length < 3) return sourceCanvas;

  const { canvas, ctx } = createSurface(sourceCanvas.width, sourceCanvas.height);

  ctx.save();
  ctx.beginPath();
  const first = points[0]!;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]!;
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return canvas;
}
