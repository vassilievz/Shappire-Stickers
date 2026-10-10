import { useEffect, useState } from 'react';
import type { AvatarDecorationOverlay } from '@shappire/contracts';
import { cx } from '@/shared/utils/cx';
import { decorationOverlayStyle } from '@/shared/components/decorationOverlayStyles';
import {
  getDecorationLoadState,
  markDecorationLoaded,
  preloadDecorationImage,
} from '@/services/avatarDecorations/decorationImageCache';

export interface DecorationOverlayImageProps {
  url: string;
  overlay?: AvatarDecorationOverlay;
  framePx: number;
  priority?: boolean;
  className?: string;
}

/** Prévia estática (ex.: thumb da galeria) — não usar no DecoratedAvatar. */
export function DecorationOverlayImage({
  url,
  overlay,
  framePx,
  priority = false,
  className,
}: DecorationOverlayImageProps) {
  const [visible, setVisible] = useState(() => getDecorationLoadState(url) === 'loaded');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (getDecorationLoadState(url) === 'loaded') {
      setVisible(true);
      return undefined;
    }
    setVisible(false);
    let cancelled = false;
    void preloadDecorationImage(url).then(() => {
      if (!cancelled) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const showSkeleton = !visible && !failed;

  return (
    <div
      className={cx('relative mx-auto', className)}
      style={{ width: framePx, height: framePx }}
    >
      {showSkeleton ? (
        <span
          className="absolute inset-0 animate-pulse rounded-lg bg-surface-3 motion-reduce:animate-none"
          aria-hidden
        />
      ) : null}
      {!failed ? (
        <img
          src={url}
          alt=""
          aria-hidden
          className={cx(
            'pointer-events-none absolute max-w-none transition-opacity duration-150',
            visible ? 'opacity-100' : 'opacity-0',
          )}
          style={decorationOverlayStyle(overlay, framePx)}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => {
            markDecorationLoaded(url);
            setVisible(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[10px] text-ink-muted" aria-hidden>!</span>
      )}
    </div>
  );
}
