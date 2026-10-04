import { cloneElement, isTransformable, type EditorElement } from './elements';
import { moveDown, moveItem, moveUp } from '@/shared/utils/collections';


export function elementIndexById(elements: readonly EditorElement[], id: string): number {
  return elements.findIndex((element) => element.id === id);
}

export function moveElementTo(elements: readonly EditorElement[], id: string, targetIndex: number): EditorElement[] {
  const from = elementIndexById(elements, id);
  if (from < 0) return [...elements];
  const clampedTarget = Math.max(0, Math.min(elements.length - 1, targetIndex));
  return moveItem(elements, from, clampedTarget);
}

export function bringForward(elements: readonly EditorElement[], id: string): EditorElement[] {
  const from = elementIndexById(elements, id);
  if (from < 0) return [...elements];
  return moveUp(elements, from);
}

export function sendBackward(elements: readonly EditorElement[], id: string): EditorElement[] {
  const from = elementIndexById(elements, id);
  if (from < 0) return [...elements];
  return moveDown(elements, from);
}

export function bringToFront(elements: readonly EditorElement[], id: string): EditorElement[] {
  const from = elementIndexById(elements, id);
  if (from < 0) return [...elements];
  return moveItem(elements, from, elements.length - 1);
}

export function sendToBack(elements: readonly EditorElement[], id: string): EditorElement[] {
  const from = elementIndexById(elements, id);
  if (from < 0) return [...elements];
  return moveItem(elements, from, 0);
}

export function toggleVisibility(elements: readonly EditorElement[], id: string): EditorElement[] {
  return elements.map((element) =>
    element.id === id ? { ...element, visible: !element.visible } : element,
  );
}

export function toggleLock(elements: readonly EditorElement[], id: string): EditorElement[] {
  return elements.map((element) => (element.id === id ? { ...element, locked: !element.locked } : element));
}

export function removeElement(elements: readonly EditorElement[], id: string): EditorElement[] {
  return elements.filter((element) => element.id !== id);
}


export function duplicateElement(elements: readonly EditorElement[], id: string): {
  elements: EditorElement[];
  newId: string | null;
} {
  const index = elementIndexById(elements, id);
  const original = index >= 0 ? elements[index] : undefined;
  if (!original) return { elements: [...elements], newId: null };
  const copy = cloneElement(original);
  const next = [...elements];
  next.splice(index + 1, 0, copy);
  return { elements: next, newId: copy.id };
}


export function layerPositionLabel(index: number, total: number): string {
  if (total <= 1) return 'Única camada';
  if (index === total - 1) return 'Frente';
  if (index === 0) return 'Fundo';
  return `${index + 1}º de ${total}`;
}


export function isEditable(element: EditorElement): boolean {
  return !element.locked && element.visible;
}

export function canTransform(element: EditorElement): boolean {
  return isTransformable(element) && isEditable(element);
}
