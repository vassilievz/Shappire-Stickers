import { createId } from '@/shared/utils/id';
import { hashObject } from '@/shared/utils/hash';
import type { DrawingElement, DrawingStroke, EditorElement } from './elements';
import { createDrawingElement } from './elements';


export function isDrawingElement(element: EditorElement): element is DrawingElement {
  return element.kind === 'drawing';
}

export function createStroke(
  mode: DrawingStroke['mode'],
  color: string,
  width: number,
  firstPoint: readonly [number, number],
): DrawingStroke {
  return { id: createId('strk'), mode, color, width, points: [firstPoint[0], firstPoint[1]] };
}


export function appendPointToStroke(
  stroke: DrawingStroke,
  x: number,
  y: number,
  minDistance = 1.5,
): DrawingStroke {
  const count = stroke.points.length;
  if (count >= 2) {
    const lastX = stroke.points[count - 2];
    const lastY = stroke.points[count - 1];
    if (lastX !== undefined && lastY !== undefined && Math.hypot(x - lastX, y - lastY) < minDistance) {
      return stroke;
    }
  }
  return { ...stroke, points: [...stroke.points, x, y] };
}

export function strokePointCount(stroke: DrawingStroke): number {
  return Math.floor(stroke.points.length / 2);
}


export function isRenderableStroke(stroke: DrawingStroke): boolean {
  return stroke.points.length >= 2;
}

export function renderableStrokes(strokes: readonly DrawingStroke[]): DrawingStroke[] {
  return strokes.filter(isRenderableStroke);
}


export function replaceStroke(strokes: readonly DrawingStroke[], stroke: DrawingStroke): DrawingStroke[] {
  const index = strokes.findIndex((item) => item.id === stroke.id);
  if (index < 0) return [...strokes, stroke];
  return strokes.map((item, i) => (i === index ? stroke : item));
}

export function removeLastStroke(strokes: readonly DrawingStroke[]): DrawingStroke[] {
  if (strokes.length === 0) return [...strokes];
  return strokes.slice(0, -1);
}

export function clearDrawingStrokes(): DrawingStroke[] {
  return [];
}


export function ensureDrawingLayer(elements: readonly EditorElement[]): {
  elements: EditorElement[];
  layerId: string;
} {
  const index = elements.findIndex(isDrawingElement);
  const existing = index >= 0 ? elements[index] : undefined;
  if (existing && isDrawingElement(existing)) {
    return { elements: [...elements], layerId: existing.id };
  }
  const layer = createDrawingElement();
  return { elements: [layer, ...elements], layerId: layer.id };
}


export function drawingRevision(strokes: readonly DrawingStroke[]): string {
  const relevant = renderableStrokes(strokes);
  if (relevant.length === 0) return 'empty';
  return hashObject(relevant);
}
