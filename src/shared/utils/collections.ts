

function isValidIndex(list: readonly unknown[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < list.length;
}


export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (!isValidIndex(list, from) || to < 0 || to >= list.length || from === to) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(to, 0, item);
  return next;
}

export function moveUp<T>(list: readonly T[], index: number): T[] {
  return moveItem(list, index, index - 1 < 0 ? 0 : index - 1);
}

export function moveDown<T>(list: readonly T[], index: number): T[] {
  const last = list.length - 1;
  return moveItem(list, index, index + 1 > last ? last : index + 1);
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  if (!isValidIndex(list, index)) return [...list];
  return list.filter((_, i) => i !== index);
}

export function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  if (!isValidIndex(list, index)) return [...list];
  return list.map((current, i) => (i === index ? item : current));
}

export function updateById<T extends { id: string }>(list: readonly T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function findById<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  return list.find((item) => item.id === id);
}

export function isNonEmptyArray<T>(value: readonly T[] | undefined | null): value is readonly [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}
