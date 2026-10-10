import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cx } from '@/shared/utils/cx';
import {
  ANCHORED_MENU_GAP_PX,
  ANCHORED_MENU_MARGIN_PX,
  computeAnchoredMenuPosition,
  readShellBottomReservedPx,
  type AnchoredMenuCoords,
} from '@/shared/utils/anchoredMenuPosition';

export interface SocialMenuAction {
  id: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface SocialOverflowMenuProps {
  actions: SocialMenuAction[];
  ariaLabel?: string;
}

export function SocialOverflowMenu({ actions, ariaLabel }: SocialOverflowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<AnchoredMenuCoords | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const next = computeAnchoredMenuPosition(
      rect,
      menu.offsetWidth,
      menu.offsetHeight,
      {
        width: window.innerWidth,
        height: window.innerHeight,
        bottomReservedPx: readShellBottomReservedPx(),
      },
    );
    setCoords(next);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, actions.length, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (actions.length === 0) return null;

  const menuPanel = open
    ? createPortal(
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="fixed inset-0 z-[45] cursor-default bg-transparent"
            onClick={close}
          />
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              zIndex: 50,
              left: coords?.left ?? ANCHORED_MENU_MARGIN_PX,
              top: coords?.top ?? ANCHORED_MENU_GAP_PX,
              maxHeight: coords?.maxHeight,
              visibility: coords ? 'visible' : 'hidden',
              maxWidth: `calc(100vw - ${ANCHORED_MENU_MARGIN_PX * 2}px)`,
              minWidth: `min(12rem, calc(100vw - ${ANCHORED_MENU_MARGIN_PX * 2}px))`,
            }}
            className="w-max overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={cx(
                  'flex w-full min-h-[44px] items-center whitespace-nowrap px-3 text-left text-[13px] hover:bg-surface-2',
                  action.danger ? 'text-danger' : 'text-ink-soft',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                  action.onClick();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? t('community.moreActions')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {menuPanel}
    </div>
  );
}
