export const ANCHORED_MENU_MARGIN_PX = 12;
export const ANCHORED_MENU_GAP_PX = 4;

export interface AnchoredMenuCoords {
  left: number;
  top: number;
  maxHeight: number;
}

export interface ViewportInsets {
  width: number;
  height: number;
  bottomReservedPx: number;
}

/** Pure geometry for anchoring a menu to a trigger rect inside the viewport. */
export function computeAnchoredMenuPosition(
  trigger: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  menuWidth: number,
  menuHeight: number,
  viewport: ViewportInsets,
): AnchoredMenuCoords {
  const margin = ANCHORED_MENU_MARGIN_PX;
  const gap = ANCHORED_MENU_GAP_PX;
  const maxW = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(Math.max(menuWidth, 0), maxW);

  let left = trigger.right - width;
  if (left < margin) left = margin;
  if (left + width > viewport.width - margin) {
    left = Math.max(margin, viewport.width - margin - width);
  }

  const spaceBelow = viewport.height - trigger.bottom - gap - viewport.bottomReservedPx;
  const spaceAbove = trigger.top - gap - margin;
  let top = trigger.bottom + gap;
  if (menuHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = Math.max(margin, trigger.top - gap - menuHeight);
  }

  const availableBelow = viewport.height - top - viewport.bottomReservedPx - margin;
  const availableAbove = top - margin;
  const maxHeight = Math.max(
    44,
    Math.min(menuHeight, viewport.height - margin * 2, Math.max(availableBelow, availableAbove)),
  );

  if (top + maxHeight > viewport.height - viewport.bottomReservedPx - margin) {
    top = Math.max(margin, viewport.height - viewport.bottomReservedPx - margin - maxHeight);
  }

  return { left, top, maxHeight };
}

export function readShellBottomReservedPx(): number {
  if (typeof document === 'undefined') return 72;
  const root = document.documentElement;
  const navVar = getComputedStyle(root).getPropertyValue('--shell-nav-height').trim();
  let navPx = 58;
  if (navVar.endsWith('rem')) {
    const rem = parseFloat(navVar);
    const fontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
    navPx = rem * fontSize;
  } else if (navVar.endsWith('px')) {
    navPx = parseFloat(navVar);
  }
  return navPx + ANCHORED_MENU_MARGIN_PX;
}
