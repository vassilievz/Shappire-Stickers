import type { CSSProperties } from 'react';
import type { AvatarDecorationOverlay } from '@shappire/contracts';

export const DEFAULT_DECORATION_OVERLAY: AvatarDecorationOverlay = {
  scale: 1.18,
  offsetX: 0,
  offsetY: 0,
  fit: 'contain',
};

export function decorationOverlayStyle(
  overlay: AvatarDecorationOverlay | undefined,
  avatarPx: number,
): CSSProperties {
  const o = overlay ?? DEFAULT_DECORATION_OVERLAY;
  const scale = o.scale ?? DEFAULT_DECORATION_OVERLAY.scale;
  const size = avatarPx * scale;
  return {
    width: size,
    height: size,
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${o.offsetX ?? 0}px), calc(-50% + ${o.offsetY ?? 0}px))`,
    objectFit: o.fit ?? 'contain',
  };
}
