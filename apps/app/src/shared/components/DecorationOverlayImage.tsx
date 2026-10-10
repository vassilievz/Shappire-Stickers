import { useEffect, useState } from 'react';
import type { AvatarDecorationOverlay } from '@shappire/contracts';
import { cx } from '@/shared/utils/cx';
import {
  getDecorationLoadState,
  markDecorationLoaded,
  preloadDecorationImage,
} from '@/services/avatarDecorations/decorationImageCache';

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

export interface DecorationOverlayImageProps {
  url: string;
  overlay?: AvatarDecorationOverlay;
  framePx: number;
  priority?: boolean;
  className?: string;
}

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
    <div className={cx('relative flex items-center justify-center', className)} style={{ width: framePx, height: framePx }}>
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
          style={overlayStyle(overlay, framePx)}
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
