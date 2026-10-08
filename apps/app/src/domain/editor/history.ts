import { EDITOR_CONFIG } from '@/config/editor';


export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export function createHistory<T>(present: T, limit: number = EDITOR_CONFIG.historyLimit): HistoryState<T> {
  return { past: [], present, future: [], limit: Math.max(1, limit) };
}


export function pushHistory<T>(history: HistoryState<T>, next: T): HistoryState<T> {
  const past = [...history.past, history.present];
  const overflow = Math.max(0, past.length - history.limit);
  return {
    past: overflow > 0 ? past.slice(overflow) : past,
    present: next,
    future: [],
    limit: history.limit,
  };
}


export function commitHistory<T>(history: HistoryState<T>, producer: (present: T) => T): HistoryState<T> {
  const next = producer(history.present);
  if (Object.is(next, history.present)) return history;
  return pushHistory(history, next);
}


export function replacePresent<T>(history: HistoryState<T>, present: T): HistoryState<T> {
  return { ...history, present };
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    limit: history.limit,
  };
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    limit: history.limit,
  };
}

export function historyDepth<T>(history: HistoryState<T>): { undo: number; redo: number } {
  return { undo: history.past.length, redo: history.future.length };
}
