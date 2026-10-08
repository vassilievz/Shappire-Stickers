import { describe, expect, it } from 'vitest';
import {
  appendMaskStroke,
  createMaskStroke,
  hasMask,
  maskRevision,
  removeStrokesById,
  restoreAlongPath,
  strokesInPath,
} from './mask';

const SIZE = { width: 512, height: 512 };

describe('máscara de recorte', () => {
  it('cria e acumula traços, ignorando toques sem arraste', () => {
    const stroke = createMaskStroke([0.5, 0.5, 0.6, 0.6], 20);
    const empty = createMaskStroke([], 20);

    const withStroke = appendMaskStroke([], stroke);
    expect(withStroke).toHaveLength(1);
    expect(appendMaskStroke(withStroke, empty)).toHaveLength(1);
  });

  it('um toque único (sem arraste) já é um recorte válido', () => {
    expect(hasMask([])).toBe(false);
    expect(hasMask([createMaskStroke([0.5, 0.5], 20)])).toBe(true);
    expect(hasMask([createMaskStroke([0.5, 0.5, 0.6, 0.6], 20)])).toBe(true);
  });

  it('encontra traços próximos do caminho do pincel', () => {
    const near = createMaskStroke([0.5, 0.5, 0.52, 0.52], 20);
    const far = createMaskStroke([0.05, 0.05, 0.07, 0.07], 20);
    const strokes = [near, far];

    const found = strokesInPath(strokes, [256, 256, 260, 260], 12, SIZE);
    expect(found).toEqual([near.id]);
  });

  it('restaura apenas as áreas apagadas que tocam o caminho', () => {
    const near = createMaskStroke([0.5, 0.5, 0.52, 0.52], 20);
    const far = createMaskStroke([0.1, 0.1, 0.12, 0.12], 20);
    const remaining = restoreAlongPath([near, far], [256, 256], 12, SIZE);
    expect(remaining.map((stroke) => stroke.id)).toEqual([far.id]);
  });

  it('remove traços por id sem alterar os demais', () => {
    const first = createMaskStroke([0.1, 0.1, 0.2, 0.2], 8);
    const second = createMaskStroke([0.3, 0.3, 0.4, 0.4], 8);
    expect(removeStrokesById([first, second], [first.id]).map((s) => s.id)).toEqual([second.id]);
    expect(removeStrokesById([first, second], [])).toHaveLength(2);
  });

  it('gera uma chave de cache estável e diferente quando a máscara muda', () => {
    const stroke = createMaskStroke([0.1, 0.1, 0.2, 0.2], 8);
    expect(maskRevision([])).toBe('no-mask');
    expect(maskRevision([stroke])).toBe(maskRevision([{ ...stroke }]));
    expect(maskRevision([stroke])).not.toBe(
      maskRevision([{ ...stroke, points: [0.1, 0.1, 0.9, 0.9] }]),
    );
  });
});
