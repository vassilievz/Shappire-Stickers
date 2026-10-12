import { type RefObject, useEffect, useRef } from 'react';
import { EDITOR_CONFIG } from '@/config/editor';
import { clamp } from '@/shared/utils/math';
import { useEditorStore } from '@/features/editor/store/editorStore';

function touchDistance(touches: TouchList): number {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function touchMidpoint(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return { x: 0, y: 0 };
  return {
    x: (first.clientX + second.clientX) / 2 - rect.left,
    y: (first.clientY + second.clientY) / 2 - rect.top,
  };
}

export function useEditorPinchZoom(containerRef: RefObject<HTMLDivElement | null>) {
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const distance = touchDistance(event.touches);
      pinchRef.current = { distance, zoom: useEditorStore.getState().viewport.zoom };
    };

    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const distance = touchDistance(event.touches);
      const ratio = distance / Math.max(1, pinch.distance);
      const current = useEditorStore.getState().viewport;
      const zoom = clamp(pinch.zoom * ratio, EDITOR_CONFIG.minZoom, EDITOR_CONFIG.maxZoom);
      const mid = touchMidpoint(event.touches, rect);
      const worldX = (mid.x - current.offsetX) / current.zoom;
      const worldY = (mid.y - current.offsetY) / current.zoom;
      useEditorStore.getState().setViewport({
        zoom,
        offsetX: mid.x - worldX * zoom,
        offsetY: mid.y - worldY * zoom,
      });
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef]);
}
