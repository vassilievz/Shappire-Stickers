import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { ActiveAvatarDecoration } from '@shappire/contracts';
import { DecorationOverlayImage } from '@/shared/components/DecorationOverlayImage';
import { cx } from '@/shared/utils/cx';

export type DecoratedAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<DecoratedAvatarSize, number> = {
  xs: 32,
  sm: 40,
  md: 44,
  lg: 64,
  xl: 112,
};

export interface DecoratedAvatarProps {
  src: string | null;
  alt?: string;
  size?: DecoratedAvatarSize;
  decoration?: ActiveAvatarDecoration | null;
  className?: string;
  avatarClassName?: string;
  borderClassName?: string;
  /** Preview principal — prioriza carregamento da decoração. */
  decorationPriority?: boolean;
}

export function DecoratedAvatar({
  src,
  alt = '',
  size = 'md',
  decoration,
  className,
  avatarClassName,
  borderClassName = 'border-line',
  decorationPriority = false,
}: DecoratedAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const avatarPx = SIZE_PX[size];
  const framePx = Math.round(avatarPx * 1.28);

  const showDecoration = Boolean(decoration?.url);

  return (
    <div
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: framePx, height: framePx }}
    >
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: avatarPx, height: avatarPx }}
      >
        {src && !failed ? (
          <img
            src={src}
            alt={alt}
            className={cx('size-full object-cover bg-surface-2', avatarClassName)}
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className={cx(
              'flex size-full items-center justify-center rounded-full border bg-surface-2 text-ink-muted',
              borderClassName,
            )}
          >
            <UserRound className="size-[45%]" aria-hidden />
          </div>
        )}
      </div>
      {showDecoration ? (
        <DecorationOverlayImage
          url={decoration!.url}
          overlay={decoration!.overlay}
          framePx={avatarPx}
          priority={decorationPriority}
          className="absolute inset-0 z-[1] size-full"
        />
      ) : null}
    </div>
  );
}
