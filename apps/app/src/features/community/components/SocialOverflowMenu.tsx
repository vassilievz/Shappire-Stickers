import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cx } from '@/shared/utils/cx';

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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel ?? t('community.moreActions')}
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={cx(
                'flex w-full min-h-[44px] items-center px-3 text-left text-[13px] hover:bg-surface-2',
                action.danger ? 'text-danger' : 'text-ink-soft',
              )}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
