import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { ActiveAvatarDecoration } from '@shappire/contracts';
import { cx } from '@/shared/utils/cx';
import { decorationOverlayStyle } from '@/shared/components/decorationOverlayStyles';
import {
  getDecorationLoadState,
  markDecorationLoaded,
  preloadDecorationImage,
} from '@/services/avatarDecorations/decorationImageCache';

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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [decorationVisible, setDecorationVisible] = useState(
    () => !decoration?.url || getDecorationLoadState(decoration.url) === 'loaded',
  );

  useEffect(() => setAvatarFailed(false), [src]);

  useEffect(() => {
    const url = decoration?.url;
    if (!url) {
      setDecorationVisible(false);
      return undefined;
    }
    if (getDecorationLoadState(url) === 'loaded') {
      setDecorationVisible(true);
      return undefined;
    }
    setDecorationVisible(false);
    let cancelled = false;
    void preloadDecorationImage(url).then(() => {
      if (!cancelled) setDecorationVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [decoration?.url]);

  const avatarPx = SIZE_PX[size];
  const framePx = Math.round(avatarPx * 1.28);
  const decorationUrl = decoration?.url;

  return (
    <div
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: framePx, height: framePx }}
    >
      <div
        className="relative z-0 overflow-hidden rounded-full"
        style={{ width: avatarPx, height: avatarPx }}
      >
        {src && !avatarFailed ? (
          <img
            src={src}
            alt={alt}
            className={cx('size-full object-cover bg-surface-2', avatarClassName)}
            onError={() => setAvatarFailed(true)}
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
      {decorationUrl ? (
        <img
          src={decorationUrl}
          alt=""
          aria-hidden
          className={cx(
            'pointer-events-none absolute z-[1] max-w-none transition-opacity duration-150',
            decorationVisible ? 'opacity-100' : 'opacity-0',
          )}
          style={decorationOverlayStyle(decoration?.overlay, avatarPx)}
          loading={decorationPriority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={decorationPriority ? 'high' : 'auto'}
          onLoad={() => {
            markDecorationLoaded(decorationUrl);
            setDecorationVisible(true);
          }}
        />
      ) : null}
    </div>
  );
}
