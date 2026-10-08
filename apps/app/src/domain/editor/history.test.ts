import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  createHistory,
  historyDepth,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
} from './history';

describe('histórico de edição', () => {
  it('começa sem operações para desfazer/refazer', () => {
    const history = createHistory(['a']);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(historyDepth(history)).toEqual({ undo: 0, redo: 0 });
  });

  it('empilha operações e permite desfazer/refazer', () => {
    let history = createHistory<string[]>([]);
    history = pushHistory(history, ['a']);
    history = pushHistory(history, ['a', 'b']);

    expect(history.present).toEqual(['a', 'b']);
    expect(historyDepth(history)).toEqual({ undo: 2, redo: 0 });

    history = undoHistory(history);
    expect(history.present).toEqual(['a']);
    expect(canRedo(history)).toBe(true);

    history = redoHistory(history);
    expect(history.present).toEqual(['a', 'b']);
  });

  it('respeita o limite máximo de operações', () => {
    let history = createHistory<number[]>([], 3);
    for (let index = 0; index < 10; index += 1) {
      history = pushHistory(history, [index]);
    }
    expect(history.past).toHaveLength(3);
    expect(history.present).toEqual([9]);
  });

  it('replacePresent atualiza sem criar entrada no histórico', () => {
    const history = replacePresent(createHistory(['a']), ['a', 'b']);
    expect(history.present).toEqual(['a', 'b']);
    expect(canUndo(history)).toBe(false);
  });

  it('desfazer além do início não altera o estado', () => {
    const history = createHistory(['a']);
    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });

  it('um novo push após desfazer descarta o futuro', () => {
    let history = createHistory<string[]>([]);
    history = pushHistory(history, ['a']);
    history = pushHistory(history, ['a', 'b']);
    history = undoHistory(history);
    history = pushHistory(history, ['a', 'c']);
    expect(canRedo(history)).toBe(false);
    expect(history.present).toEqual(['a', 'c']);
  });
});
