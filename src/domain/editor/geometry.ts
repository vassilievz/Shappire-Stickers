import { EDITOR_CONFIG } from '@/config/editor';
import { clamp } from '@/shared/utils/math';
import { isTransformable, type EditorElement } from './elements';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}


export function elementCenter(element: EditorElement): Point {
  if (!isTransformable(element)) {
    const half = EDITOR_CONFIG.canvasSize / 2;
    return { x: half, y: half };
  }
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 };
}


export function elementBounds(element: EditorElement): Rect {
  if (!isTransformable(element)) {
    return { x: 0, y: 0, width: EDITOR_CONFIG.canvasSize, height: EDITOR_CONFIG.canvasSize };
  }
  const center = elementCenter(element);
  const radians = (element.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}


export function fitInsideBox(
  naturalWidth: number,
  naturalHeight: number,
  boxSize: number,
  fillRatio = 0.9,
): { width: number; height: number } {
  const safeWidth = Math.max(1, naturalWidth);
  const safeHeight = Math.max(1, naturalHeight);
  const target = boxSize * fillRatio;
  const ratio = Math.min(target / safeWidth, target / safeHeight);
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}


export function centerInCanvas(
  width: number,
  height: number,
  canvasSize: number = EDITOR_CONFIG.canvasSize,
): Point {
  return { x: Math.round((canvasSize - width) / 2), y: Math.round((canvasSize - height) / 2) };
}


export function screenToCanvas(
  point: Point,
  transform: { zoom: number; offsetX: number; offsetY: number },
): Point {
  return {
    x: (point.x - transform.offsetX) / transform.zoom,
    y: (point.y - transform.offsetY) / transform.zoom,
  };
}


export function isPointInsideElement(element: EditorElement, point: Point): boolean {
  if (!isTransformable(element)) return true;
  const center = elementCenter(element);
  const radians = (-element.rotation * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= element.width / 2 && Math.abs(localY) <= element.height / 2;
}


export function clampPositionToCanvas(
  element: EditorElement,
  canvasSize: number = EDITOR_CONFIG.canvasSize,
  minVisibleRatio = 0.15,
): { x: number; y: number } {
  if (!isTransformable(element)) return { x: 0, y: 0 };
  const marginX = element.width * minVisibleRatio;
  const marginY = element.height * minVisibleRatio;
  return {
    x: clamp(element.x, -element.width + marginX, canvasSize - marginX),
    y: clamp(element.y, -element.height + marginY, canvasSize - marginY),
  };
}


export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}


export function toPointPairs(flatPoints: readonly number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flatPoints.length; i += 2) {
    const x = flatPoints[i];
    const y = flatPoints[i + 1];
    if (x === undefined || y === undefined) break;
    points.push({ x, y });
  }
  return points;
}


export function distanceToPolyline(point: Point, path: readonly Point[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) {
    const single = path[0];
    return single ? Math.hypot(point.x - single.x, point.y - single.y) : Number.POSITIVE_INFINITY;
  }
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < path.length; i += 1) {
    const start = path[i];
    const end = path[i + 1];
    if (!start || !end) continue;
    min = Math.min(min, distanceToSegment(point, start, end));
  }
  return min;
}
