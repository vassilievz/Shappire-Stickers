import type { EditorFontId } from '@/config/editor';
import { DEFAULT_FONT_ID, EDITOR_CONFIG } from '@/config/editor';
import { createId } from '@/shared/utils/id';


export type ElementKind = 'image' | 'text' | 'drawing';

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  width: number;
}

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}


export interface MaskStroke {
  id: string;
  brushSize: number;
  
  points: number[];
}

export interface ImageElement {
  kind: 'image';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  
  assetPath: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  
  rotation: number;
  opacity: number;
  stroke: StrokeStyle;
  maskStrokes: MaskStroke[];
}

export interface TextElement {
  kind: 'text';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  text: string;
  fontId: EditorFontId;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  stroke: StrokeStyle;
  shadow: ShadowStyle;
}

export interface DrawingStroke {
  id: string;
  mode: 'paint' | 'erase';
  color: string;
  width: number;
  
  points: number[];
}


export interface DrawingElement {
  kind: 'drawing';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  strokes: DrawingStroke[];
}

export type EditorElement = ImageElement | TextElement | DrawingElement;


export type TransformableElement = ImageElement | TextElement;

export function isTransformable(element: EditorElement): element is TransformableElement {
  return element.kind === 'image' || element.kind === 'text';
}

export const ELEMENT_LABELS: Record<ElementKind, string> = {
  image: 'Imagem',
  text: 'Texto',
  drawing: 'Desenho',
};


export function elementDisplayName(element: EditorElement): string {
  switch (element.kind) {
    case 'image':
      return element.name.trim() === '' ? 'Imagem' : element.name;
    case 'text': {
      const preview = element.text.trim().replace(/\s+/g, ' ');
      return preview === '' ? 'Texto vazio' : preview.slice(0, 28);
    }
    case 'drawing':
      return element.strokes.length === 0 ? 'Desenho vazio' : `Desenho (${element.strokes.length})`;
  }
}

export interface CreateImageElementInput {
  assetPath: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

export function createImageElement(input: CreateImageElementInput): ImageElement {
  return {
    kind: 'image',
    id: createId('img'),
    name: input.name ?? 'Imagem',
    visible: true,
    locked: false,
    assetPath: input.assetPath,
    naturalWidth: input.naturalWidth,
    naturalHeight: input.naturalHeight,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: 0,
    opacity: 1,
    stroke: { enabled: false, color: '#FFFFFF', width: 0 },
    maskStrokes: [],
  };
}

export interface CreateTextElementInput {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
}

export function createTextElement(input: CreateTextElementInput): TextElement {
  return {
    kind: 'text',
    id: createId('txt'),
    name: 'Texto',
    visible: true,
    locked: false,
    text: input.text,
    fontId: DEFAULT_FONT_ID,
    fontSize: input.fontSize ?? 64,
    color: input.color ?? '#FFFFFF',
    align: 'center',
    lineHeight: 1.15,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: 0,
    opacity: 1,
    stroke: { enabled: true, color: '#111827', width: 4 },
    shadow: { enabled: true, color: 'rgba(0, 0, 0, 0.35)', blur: 8, offsetX: 0, offsetY: 3 },
  };
}

export function createDrawingElement(): DrawingElement {
  return {
    kind: 'drawing',
    id: createId('drw'),
    name: 'Desenho',
    visible: true,
    locked: false,
    strokes: [],
  };
}


export function cloneElement(
  element: EditorElement,
  offset = EDITOR_CONFIG.nudgeStep * 8,
): EditorElement {
  if (element.kind === 'drawing') {
    return {
      ...element,
      id: createId('drw'),
      strokes: element.strokes.map((stroke) => ({
        ...stroke,
        id: createId('strk'),
        points: [...stroke.points],
      })),
    };
  }
  return { ...element, id: createId(element.kind.slice(0, 3)), x: element.x + offset, y: element.y + offset };
}

export function visibleElements(elements: readonly EditorElement[]): EditorElement[] {
  return elements.filter((element) => element.visible);
}

export function elementSize(element: EditorElement): { width: number; height: number } {
  return isTransformable(element)
    ? { width: element.width, height: element.height }
    : { width: EDITOR_CONFIG.canvasSize, height: EDITOR_CONFIG.canvasSize };
}

export function elementOpacity(element: EditorElement): number {
  return isTransformable(element) ? element.opacity : 1;
}

export function elementRotation(element: EditorElement): number {
  return isTransformable(element) ? element.rotation : 0;
}
