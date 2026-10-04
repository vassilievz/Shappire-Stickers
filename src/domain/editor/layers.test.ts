import { describe, expect, it } from 'vitest';
import {
  bringForward,
  bringToFront,
  duplicateElement,
  elementIndexById,
  layerPositionLabel,
  moveElementTo,
  removeElement,
  sendBackward,
  sendToBack,
  toggleLock,
  toggleVisibility,
} from './layers';
import { createImageElement, createTextElement, type EditorElement } from './elements';

function image(name: string): EditorElement {
  return createImageElement({
    assetPath: `projects/x/assets/${name}.png`,
    naturalWidth: 100,
    naturalHeight: 100,
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    name,
  });
}

function sample(): EditorElement[] {
  return [image('a'), image('b'), image('c')];
}

function names(elements: readonly EditorElement[]): string[] {
  return elements.map((element) => element.name);
}

describe('camadas', () => {
  it('encontra o índice do elemento', () => {
    const elements = sample();
    const middle = elements[1];
    expect(middle).toBeDefined();
    expect(elementIndexById(elements, middle?.id ?? '')).toBe(1);
    expect(elementIndexById(elements, 'inexistente')).toBe(-1);
  });

  it('traz para frente e envia para trás', () => {
    const elements = sample();
    const first = elements[0];
    const middle = elements[1];
    const last = elements[2];
    if (!first || !middle || !last) throw new Error('amostra inválida');

    expect(names(bringForward(elements, middle.id))).toEqual(['b', 'a', 'c']);
    expect(names(sendBackward(elements, middle.id))).toEqual(['a', 'c', 'b']);
    expect(names(bringToFront(elements, first.id))).toEqual(['b', 'c', 'a']);
    expect(names(sendToBack(elements, last.id))).toEqual(['c', 'a', 'b']);
  });

  it('avançar o primeiro elemento (já na frente) não altera a ordem', () => {
    const elements = sample();
    const first = elements[0];
    if (!first) throw new Error('amostra inválida');
    expect(names(bringForward(elements, first.id))).toEqual(['a', 'b', 'c']);
  });

  it('não altera a lista quando o id não existe', () => {
    const elements = sample();
    expect(names(bringForward(elements, 'x'))).toEqual(names(elements));
    expect(names(sendBackward(elements, 'x'))).toEqual(names(elements));
  });

  it('move um elemento para um índice específico', () => {
    const elements = sample();
    const last = elements[2];
    if (!last) throw new Error('amostra inválida');
    expect(names(moveElementTo(elements, last.id, 0))).toEqual(['c', 'a', 'b']);
  });

  it('remove, oculta e trava elementos', () => {
    const elements = sample();
    const first = elements[0];
    if (!first) throw new Error('amostra inválida');
    expect(removeElement(elements, first.id)).toHaveLength(2);
    expect(toggleVisibility(elements, first.id)[0]?.visible).toBe(false);
    expect(toggleLock(elements, first.id)[0]?.locked).toBe(true);
  });

  it('duplica um elemento inserindo a cópia acima do original', () => {
    const elements = sample();
    const first = elements[0];
    if (!first) throw new Error('amostra inválida');
    const { elements: next, newId } = duplicateElement(elements, first.id);
    const copy = next[1];
    expect(next).toHaveLength(4);
    expect(copy?.id).toBe(newId);
    expect(copy?.id).not.toBe(first.id);
    if (copy?.kind === 'image' && first.kind === 'image') {
      expect(copy.x).not.toBe(first.x);
    }
  });

  it('gera rótulos de posição legíveis', () => {
    expect(layerPositionLabel(2, 3)).toBe('Frente');
    expect(layerPositionLabel(0, 3)).toBe('Fundo');
    expect(layerPositionLabel(1, 3)).toBe('2º de 3');
    expect(layerPositionLabel(0, 1)).toBe('Única camada');
  });

  it('mantém tipos de elemento distintos na mesma lista', () => {
    const text = createTextElement({ text: 'Oi', x: 0, y: 0, width: 10, height: 10 });
    const elements = [...sample(), text];
    expect(elements).toHaveLength(4);
    expect(names(sendToBack(elements, text.id))).toEqual([text.name, 'a', 'b', 'c']);
  });
});
