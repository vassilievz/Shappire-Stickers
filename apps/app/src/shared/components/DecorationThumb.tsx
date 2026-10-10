import { memo } from 'react';
import type { AvatarDecorationOverlay } from '@shappire/contracts';
import { DecorationOverlayImage } from './DecorationOverlayImage';
import { cx } from '@/shared/utils/cx';
import { useInView } from '@/shared/hooks/useInView';

const THUMB_FRAME = 44;

export interface DecorationThumbProps {
  url: string;
  overlay?: AvatarDecorationOverlay;
  selected?: boolean;
  label: string;
  onSelect: () => void;
}

export const DecorationThumb = memo(function DecorationThumb({
  url,
  overlay,
  selected = false,
  label,
  onSelect,
}: DecorationThumbProps) {
  const { ref, inView } = useInView<HTMLButtonElement>({ rootMargin: '80px' });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors touch-manipulation',
        selected ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      <div className="flex size-11 items-center justify-center">
        {inView ? (
          <DecorationOverlayImage url={url} overlay={overlay} framePx={THUMB_FRAME} />
        ) : (
          <span className="size-9 rounded-lg bg-surface-3" aria-hidden />
        )}
      </div>
      <span className="line-clamp-2 text-[10px] leading-tight text-ink-muted">{label}</span>
    </button>
  );
});
