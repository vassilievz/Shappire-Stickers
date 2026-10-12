import { type RefObject, useEffect, useRef, useState } from 'react';
import { EDITOR_CONFIG } from '@/config/editor';
import { clamp } from '@/shared/utils/math';
import { useEditorStore } from '@/features/editor/store/editorStore';

const CANVAS = EDITOR_CONFIG.canvasSize;

export function useEditorStageSize(containerRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(0);
  const fitRef = useRef<{ projectId: string | null; size: number }>({ projectId: null, size: 0 });
  const projectId = useEditorStore((state) => state.projectId);
  const setViewport = useEditorStore((state) => state.setViewport);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize(Math.max(0, Math.min(rect.width, rect.height)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef]);

  useEffect(() => {
    if (size <= 0) return;
    if (fitRef.current.projectId === projectId && fitRef.current.size === size) return;
    const zoom = clamp((size * 0.88) / CANVAS, EDITOR_CONFIG.minZoom, EDITOR_CONFIG.maxZoom);
    fitRef.current = { projectId, size };
    setViewport({
      zoom,
      offsetX: (size - CANVAS * zoom) / 2,
      offsetY: (size - CANVAS * zoom) / 2,
    });
  }, [size, projectId, setViewport]);

  return size;
}
