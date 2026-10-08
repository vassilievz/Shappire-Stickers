import { createId } from '@/shared/utils/id';
import { hashObject } from '@/shared/utils/hash';
import type { MaskStroke } from './elements';
import { distanceToPolyline, toPointPairs } from './geometry';


export function createMaskStroke(points: readonly number[], brushSize: number): MaskStroke {
  return { id: createId('mask'), brushSize, points: [...points] };
}


export function appendMaskStroke(strokes: readonly MaskStroke[], stroke: MaskStroke): MaskStroke[] {
  if (stroke.points.length < 2) return [...strokes];
  return [...strokes, stroke];
}

export function hasMask(strokes: readonly MaskStroke[]): boolean {
  return strokes.some((stroke) => stroke.points.length >= 2);
}


export function strokesInPath(
  strokes: readonly MaskStroke[],
  pathPoints: readonly number[],
  brushRadius: number,
  elementSize: { width: number; height: number },
): string[] {
  const path = toPointPairs(pathPoints).map((point) => ({
    x: point.x / Math.max(1, elementSize.width),
    y: point.y / Math.max(1, elementSize.height),
  }));
  if (path.length === 0) return [];
  const normalizedRadius =
    brushRadius / Math.max(1, Math.min(elementSize.width, elementSize.height));

  const ids: string[] = [];
  for (const stroke of strokes) {
    const strokePoints = toPointPairs(stroke.points);
    const strokeRadius = stroke.brushSize / 2 / Math.max(1, Math.min(elementSize.width, elementSize.height));
    const threshold = normalizedRadius + strokeRadius + strokeRadius;
    const intersects = strokePoints.some((point) => distanceToPolyline(point, path) <= threshold);
    if (intersects) ids.push(stroke.id);
  }
  return ids;
}


export function removeStrokesById(strokes: readonly MaskStroke[], ids: readonly string[]): MaskStroke[] {
  if (ids.length === 0) return [...strokes];
  const idSet = new Set(ids);
  return strokes.filter((stroke) => !idSet.has(stroke.id));
}


export function restoreAlongPath(
  strokes: readonly MaskStroke[],
  pathPoints: readonly number[],
  brushRadius: number,
  elementSize: { width: number; height: number },
): MaskStroke[] {
  const ids = strokesInPath(strokes, pathPoints, brushRadius, elementSize);
  return removeStrokesById(strokes, ids);
}

export function clearMask(): MaskStroke[] {
  return [];
}


export function maskRevision(strokes: readonly MaskStroke[]): string {
  if (!hasMask(strokes)) return 'no-mask';
  return hashObject(strokes);
}
