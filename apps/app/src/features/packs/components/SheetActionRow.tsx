import { cx } from '@/shared/utils/cx';

export function SheetActionRow({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'flex min-h-[44px] w-full items-center rounded-[12px] px-3 py-3 text-left text-[14px] transition-colors touch-manipulation',
          tone === 'danger'
            ? 'text-danger hover:bg-danger/10 active:bg-danger/15'
            : 'text-ink hover:bg-surface-2 active:bg-surface-3',
        )}
      >
        {label}
      </button>
    </li>
  );
}
