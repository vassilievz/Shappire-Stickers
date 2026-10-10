import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { ActiveAvatarDecoration, AvatarDecorationOverlay } from '@shappire/contracts';
import { cx } from '@/shared/utils/cx';

export type DecoratedAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<DecoratedAvatarSize, number> = {
  xs: 32,
  sm: 40,
  md: 44,
  lg: 64,
  xl: 112,
};

const DEFAULT_OVERLAY: AvatarDecorationOverlay = {
  scale: 1.18,
  offsetX: 0,
  offsetY: 0,
  fit: 'contain',
};

function overlayStyle(overlay: AvatarDecorationOverlay | undefined, framePx: number) {
  const o = overlay ?? DEFAULT_OVERLAY;
  const scale = o.scale ?? DEFAULT_OVERLAY.scale;
  const size = framePx * scale;
  return {
    width: size,
    height: size,
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${o.offsetX ?? 0}px), calc(-50% + ${o.offsetY ?? 0}px))`,
    objectFit: o.fit ?? 'contain',
  } as const;
}

export interface DecoratedAvatarProps {
  src: string | null;
  alt?: string;
  size?: DecoratedAvatarSize;
  decoration?: ActiveAvatarDecoration | null;
  className?: string;
  avatarClassName?: string;
  borderClassName?: string;
}

export function DecoratedAvatar({
  src,
  alt = '',
  size = 'md',
  decoration,
  className,
  avatarClassName,
  borderClassName = 'border-line',
}: DecoratedAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const avatarPx = SIZE_PX[size];
  const framePx = Math.round(avatarPx * 1.28);

  const showDecoration = Boolean(decoration?.url) && !failed;

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
        <img
          src={decoration!.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute z-[1]"
          style={overlayStyle(decoration!.overlay, avatarPx)}
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
}
