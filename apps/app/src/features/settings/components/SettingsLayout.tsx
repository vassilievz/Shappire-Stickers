import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/shared/utils/cx';

export function GroupLabel({ children }: { children: string }) {
  return (
    <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted select-none">
      {children}
    </h2>
  );
}

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      {children}
    </div>
  );
}

export function SettingsNavRow({
  label,
  value,
  onClick,
  leading,
}: {
  label: string;
  value?: string;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-[44px] items-center justify-between gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2 active:bg-surface-3 touch-manipulation"
    >
      <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-ink-soft">
        {leading}
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {value ? <span className="max-w-[140px] truncate text-[12px] text-ink-muted">{value}</span> : null}
        <ChevronRight className="size-4 text-ink-muted" aria-hidden />
      </span>
    </button>
  );
}
