import { EDITOR_CONFIG } from '@/config/editor';
import type { DrawingStroke } from '@/domain/editor/elements';
import { renderableStrokes } from '@/domain/editor/drawing';
import { type CanvasFactory, defaultCanvasFactory, getContext2D } from './canvas';

export interface RasterizeDrawingOptions {
  size?: number;
  scale?: number;
  factory?: CanvasFactory;
}


export function rasterizeDrawing(
  strokes: readonly DrawingStroke[],
  options: RasterizeDrawingOptions = {},
): HTMLCanvasElement {
  const size = options.size ?? EDITOR_CONFIG.canvasSize;
  const scale = options.scale ?? EDITOR_CONFIG.rasterScale;
  const factory = options.factory ?? defaultCanvasFactory;

  const canvas = factory(size * scale, size * scale);
  const ctx = getContext2D(canvas, { willReadFrequently: true });
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of renderableStrokes(strokes)) {
    ctx.save();
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.mode === 'erase' ? '#000000' : stroke.color;
    ctx.fillStyle = stroke.mode === 'erase' ? '#000000' : stroke.color;
    ctx.lineWidth = Math.max(0.5, stroke.width);

    const points = stroke.points;
    if (points.length === 2) {
      const x = points[0];
      const y = points[1];
      if (x !== undefined && y !== undefined) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, stroke.width / 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i + 1 < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        if (x === undefined || y === undefined) break;
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

  return canvas;
}
