import type { DrawingElement, ImageElement, TextElement } from '@/domain/editor/elements';
import { isTransformable, type EditorElement } from '@/domain/editor/elements';
import {
  appendPointToStroke,
  createStroke,
  isDrawingElement,
  replaceStroke,
} from '@/domain/editor/drawing';
import { appendMaskStroke, createMaskStroke, restoreAlongPath } from '@/domain/editor/mask';
import { clampPositionToCanvas } from '@/domain/editor/geometry';
import { showToast } from '@/state/toastStore';
import { getEditorRasters, useEditorStore } from './editorStore';

type Point = [number, number];

export function findDrawingLayer(elements: readonly EditorElement[]): DrawingElement | null {
  const layer = elements.find(isDrawingElement);
  return layer ?? null;
}


export function resolveMaskTargetId(elements: readonly EditorElement[]): string | null {
  const state = useEditorStore.getState();
  const selected = state.selectedIds[0];
  const selectedElement = selected
    ? elements.find((element) => element.id === selected)
    : undefined;
  if (selectedElement?.kind === 'image') return selectedElement.id;

  const images = elements.filter(
    (element): element is ImageElement => element.kind === 'image' && element.visible,
  );
  const topMost = images[images.length - 1];
  return topMost?.id ?? null;
}


export function updateTextElement(
  id: string,
  patch: Partial<Omit<TextElement, 'kind' | 'id'>>,
  options: { transient?: boolean } = {},
): void {
  const store = useEditorStore.getState();
  const current = store.history.present.find(
    (element): element is TextElement => element.kind === 'text' && element.id === id,
  );
  if (!current) return;

  const candidate: TextElement = { ...current, ...patch };
  const raster = getEditorRasters().getTextRaster(candidate);
  const width = raster?.width ?? candidate.width;
  const height = raster?.height ?? candidate.height;
  const centerX = candidate.x + candidate.width / 2;
  const centerY = candidate.y + candidate.height / 2;
  const next: TextElement = {
    ...candidate,
    width,
    height,
    x: centerX - width / 2,
    y: centerY - height / 2,
  };

  const mutation = (elements: readonly EditorElement[]) =>
    elements.map((element) => (element.id === id ? next : element));

  if (options.transient) store.transient(mutation);
  else store.commit(mutation);
}


export function selectedElement(): EditorElement | null {
  const store = useEditorStore.getState();
  const id = store.selectedIds[0];
  if (!id) return null;
  return store.history.present.find((element) => element.id === id) ?? null;
}


export function nudgeElement(id: string, dx: number, dy: number): void {
  const store = useEditorStore.getState();
  const element = store.history.present.find((item) => item.id === id);
  if (!element || !isTransformable(element)) return;
  const moved = { ...element, x: element.x + dx, y: element.y + dy };
  const clamped = clampPositionToCanvas(moved);
  store.commit((elements) =>
    elements.map((item) => (item.id === id && isTransformable(item) ? { ...item, ...clamped } : item)),
  );
}

export function beginDrawingStroke(point: Point, mode: 'paint' | 'erase'): void {
  const state = useEditorStore.getState();
  const stroke = createStroke(mode, state.brushColor, state.brushSize, point);
  state.setActiveStroke(stroke);
}

export function extendDrawingStroke(point: Point): void {
  const state = useEditorStore.getState();
  if (!state.activeStroke) return;
  state.setActiveStroke(appendPointToStroke(state.activeStroke, point[0], point[1]));
}

export function endDrawingStroke(): void {
  const state = useEditorStore.getState();
  const stroke = state.activeStroke;
  state.setActiveStroke(null);
  if (!stroke || stroke.points.length < 2) return;

  state.commit((elements) => {
    const layer = findDrawingLayer(elements);
    if (!layer) {
      const created: DrawingElement = {
        kind: 'drawing',
        id: `drw_${Date.now().toString(36)}`,
        name: 'Desenho',
        visible: true,
        locked: false,
        strokes: [stroke],
      };
      return [created, ...elements];
    }
    return elements.map((element) =>
      isDrawingElement(element)
        ? { ...element, strokes: replaceStroke(element.strokes, stroke) }
        : element,
    );
  });
}


export function clearDrawingLayer(): void {
  const store = useEditorStore.getState();
  const hasDrawing = findDrawingLayer(store.history.present)?.strokes.length ?? 0;
  if (hasDrawing === 0) {
    showToast('Não há desenhos para apagar.', 'info');
    return;
  }
  store.commit((elements) =>
    elements.map((element) => (isDrawingElement(element) ? { ...element, strokes: [] } : element)),
  );
  showToast('Desenhos removidos.', 'success');
}


export function undoLastDrawingStroke(): void {
  const store = useEditorStore.getState();
  store.commit((elements) =>
    elements.map((element) =>
      isDrawingElement(element) && element.strokes.length > 0
        ? { ...element, strokes: element.strokes.slice(0, -1) }
        : element,
    ),
  );
}


interface LocalPoint {
  x: number;
  y: number;
}

export function beginMaskStroke(
  targetId: string,
  point: LocalPoint,
  mode: 'erase' | 'restore',
): void {
  const state = useEditorStore.getState();
  const target = state.history.present.find((element) => element.id === targetId);
  if (!target || target.kind !== 'image') {
    showToast('Selecione uma imagem para usar esta ferramenta.', 'warning');
    return;
  }
  if (target.locked) {
    showToast('Destrave a imagem para editá-la.', 'warning');
    return;
  }
  state.setActiveMask({ targetId, points: [point.x, point.y], mode });
}

export function extendMaskStroke(point: LocalPoint): void {
  const state = useEditorStore.getState();
  const mask = state.activeMask;
  if (!mask) return;
  const lastX = mask.points[mask.points.length - 2];
  const lastY = mask.points[mask.points.length - 1];
  if (lastX !== undefined && lastY !== undefined && Math.hypot(point.x - lastX, point.y - lastY) < 2) {
    return;
  }
  state.setActiveMask({ ...mask, points: [...mask.points, point.x, point.y] });
}

export function endMaskStroke(): void {
  const state = useEditorStore.getState();
  const mask = state.activeMask;
  state.setActiveMask(null);
  if (!mask || mask.points.length < 2) return;

  const target = state.history.present.find((element) => element.id === mask.targetId);
  if (!target || target.kind !== 'image') return;

  const normalized: number[] = [];
  for (let index = 0; index + 1 < mask.points.length; index += 2) {
    const x = mask.points[index];
    const y = mask.points[index + 1];
    if (x === undefined || y === undefined) break;
    normalized.push(x / Math.max(1, target.width), y / Math.max(1, target.height));
  }

  const size = { width: target.width, height: target.height };

  state.commit((elements) =>
    elements.map((element) => {
      if (element.id !== mask.targetId || element.kind !== 'image') return element;
      if (mask.mode === 'erase') {
        const stroke = createMaskStroke(normalized, state.maskBrushSize);
        return { ...element, maskStrokes: appendMaskStroke(element.maskStrokes, stroke) };
      }
      return { ...element, maskStrokes: restoreAlongPath(element.maskStrokes, normalized, state.maskBrushSize, size) };
    }),
  );
}


export function clearMaskOfElement(id: string): void {
  const store = useEditorStore.getState();
  const target = store.history.present.find((element) => element.id === id);
  if (!target || target.kind !== 'image') return;
  if (target.maskStrokes.length === 0) {
    showToast('Esta imagem não tem áreas recortadas.', 'info');
    return;
  }
  store.commit((elements) =>
    elements.map((element) =>
      element.id === id && element.kind === 'image' ? { ...element, maskStrokes: [] } : element,
    ),
  );
  showToast('Recorte restaurado.', 'success');
}
