/** Contagem de overlays abertos — evita `overflow`/`touch-action` presos no body. */
let lockCount = 0;
let savedOverflow = '';
let savedTouchAction = '';

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (lockCount <= 0) {
    lockCount = 0;
    return;
  }
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.touchAction = savedTouchAction;
  }
}

/** Só para testes — não usar em produção. */
export function resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedOverflow = '';
  savedTouchAction = '';
}

export function getBodyScrollLockCountForTests(): number {
  return lockCount;
}

/** Remove estilos inline do body se nenhum overlay está segurando o lock. */
export function ensureBodyScrollUnlocked(): void {
  if (lockCount !== 0) return;
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('touch-action');
}
