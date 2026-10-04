import { describe, expect, it } from 'vitest';
import {
  appendPointToStroke,
  createStroke,
  drawingRevision,
  ensureDrawingLayer,
  isDrawingElement,
  removeLastStroke,
  renderableStrokes,
  replaceStroke,
  strokePointCount,
} from './drawing';
import { createImageElement, type DrawingElement } from './elements';

describe('desenho livre', () => {
  it('acrescenta pontos respeitando a distância mínima de suavização', () => {
    const stroke = createStroke('paint', '#FFFFFF', 8, [10, 10]);
    const tooClose = appendPointToStroke(stroke, 10.5, 10.5);
    expect(strokePointCount(tooClose)).toBe(1);
    const next = appendPointToStroke(stroke, 20, 20);
    expect(strokePointCount(next)).toBe(2);
    expect(next.points).toEqual([10, 10, 20, 20]);
  });

  it('substitui o último traço pelo id', () => {
    const first = createStroke('paint', '#fff', 4, [0, 0]);
    const second = createStroke('paint', '#000', 4, [5, 5]);
    const updated = { ...first, points: [1, 1, 2, 2] };
    const result = replaceStroke([first, second], updated);
    expect(result[0]?.points).toEqual([1, 1, 2, 2]);
    expect(result).toHaveLength(2);

    const added = replaceStroke([first], second);
    expect(added).toHaveLength(2);
  });

  it('remove apenas o último traço', () => {
    const strokes = [createStroke('paint', '#fff', 4, [0, 0]), createStroke('paint', '#fff', 4, [1, 1])];
    expect(removeLastStroke(strokes)).toHaveLength(1);
    expect(removeLastStroke([])).toHaveLength(0);
  });

  it('filtra traços que não podem ser rasterizados', () => {
    const empty = { ...createStroke('paint', '#fff', 4, [0, 0]), points: [0] };
    const valid = createStroke('paint', '#fff', 4, [0, 0]);
    expect(renderableStrokes([empty, valid])).toHaveLength(1);
  });

  it('cria a camada de desenho uma única vez, sempre no fundo', () => {
    const image = createImageElement({
      assetPath: 'a.png',
      naturalWidth: 10,
      naturalHeight: 10,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const created = ensureDrawingLayer([image]);
    expect(created.elements).toHaveLength(2);
    expect(isDrawingElement(created.elements[0] as DrawingElement)).toBe(true);

    const again = ensureDrawingLayer(created.elements);
    expect(again.layerId).toBe(created.layerId);
    expect(again.elements).toHaveLength(2);
  });

  it('gera chave de cache vazia e estável', () => {
    expect(drawingRevision([])).toBe('empty');
    const stroke = { ...createStroke('paint', '#fff', 4, [0, 0]), points: [0, 0, 1, 1] };
    expect(drawingRevision([stroke])).toBe(drawingRevision([{ ...stroke }]));
    expect(drawingRevision([stroke])).not.toBe(drawingRevision([{ ...stroke, color: '#000' }]));
  });
});
