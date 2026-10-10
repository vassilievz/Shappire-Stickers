import { describe, expect, it } from 'vitest';
import { computeAnchoredMenuPosition } from './anchoredMenuPosition';

const viewport = { width: 360, height: 800, bottomReservedPx: 72 };

describe('computeAnchoredMenuPosition', () => {
  it('alinha pela direita do trigger e mantém o menu dentro da largura', () => {
    const trigger = { top: 100, right: 340, bottom: 140, left: 300 };
    const coords = computeAnchoredMenuPosition(trigger, 220, 180, viewport);
    expect(coords.left).toBeGreaterThanOrEqual(12);
    expect(coords.left + 220).toBeLessThanOrEqual(360 - 12);
    expect(coords.top).toBeGreaterThanOrEqual(12);
  });

  it('empurra o menu para a esquerda quando a borda direita está no limite', () => {
    const trigger = { top: 80, right: 358, bottom: 120, left: 318 };
    const coords = computeAnchoredMenuPosition(trigger, 240, 200, viewport);
    expect(coords.left).toBe(360 - 12 - 240);
  });

  it('prefere abrir acima quando não há espaço abaixo', () => {
    const trigger = { top: 650, right: 340, bottom: 690, left: 300 };
    const coords = computeAnchoredMenuPosition(trigger, 200, 160, viewport);
    expect(coords.top).toBeLessThan(trigger.top);
  });

  it('viewport estreito 320px não deixa left negativo', () => {
    const narrow = { width: 320, height: 568, bottomReservedPx: 72 };
    const trigger = { top: 50, right: 308, bottom: 90, left: 268 };
    const coords = computeAnchoredMenuPosition(trigger, 280, 200, narrow);
    expect(coords.left).toBeGreaterThanOrEqual(12);
    expect(coords.left).toBeLessThanOrEqual(320 - 12 - 1);
  });
});
