import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Circle,
  Crop,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react';
import { Button, IconButton } from '@/shared/components/primitives';
import { clamp } from '@/shared/utils/math';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

export type CropAspectRatio = '1:1' | 'free' | 'circle' | '3:4' | '4:3';

export interface ImageCropResult {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ImageCropperModalProps {
  open: boolean;
  imageSrc: string | null;
  initialRatio?: CropAspectRatio;
  onClose: () => void;
  onCropComplete: (result: ImageCropResult) => void;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropperModal({
  open,
  imageSrc,
  initialRatio = '1:1',
  onClose,
  onCropComplete,
}: ImageCropperModalProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ratio, setRatio] = useState<CropAspectRatio>(initialRatio);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  const [processing, setProcessing] = useState(false);

  const dragRef = useRef<{
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
    startX: number;
    startY: number;
    initialBox: CropBox;
    containerRect: DOMRect;
  } | null>(null);

  const pinchRef = useRef<{ distance: number; initialZoom: number } | null>(null);

  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setRotation(0);
      setZoom(1);

      const imgAspect = img.naturalWidth / img.naturalHeight;
      if (initialRatio === '1:1' || initialRatio === 'circle') {
        if (imgAspect >= 1) {
          const w = 1 / imgAspect;
          setCropBox({
            x: Math.max(0, (1 - w) / 2),
            y: 0.02,
            width: Math.min(0.96, w),
            height: 0.96,
          });
        } else {
          const h = imgAspect;
          setCropBox({
            x: 0.02,
            y: Math.max(0, (1 - h) / 2),
            width: 0.96,
            height: Math.min(0.96, h),
          });
        }
      } else {
        setCropBox({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
      }
    };
    img.src = imageSrc;
  }, [open, imageSrc, initialRatio]);

  const applyRatioToBox = useCallback(
    (currentBox: CropBox, targetRatio: CropAspectRatio) => {
      if (!naturalSize) return currentBox;
      const imgAspect = naturalSize.width / naturalSize.height;

      if (targetRatio === 'free') return currentBox;
      const desiredAspect =
        targetRatio === '1:1' || targetRatio === 'circle'
          ? 1
          : targetRatio === '3:4'
            ? 3 / 4
            : 4 / 3;

      const normRatio = desiredAspect / imgAspect;
      let newW = currentBox.width;
      let newH = newW / normRatio;

      if (newH > 0.98) {
        newH = 0.98;
        newW = newH * normRatio;
      }
      if (newW > 0.98) {
        newW = 0.98;
        newH = newW / normRatio;
      }

      const newX = clamp(currentBox.x + (currentBox.width - newW) / 2, 0, 1 - newW);
      const newY = clamp(currentBox.y + (currentBox.height - newH) / 2, 0, 1 - newH);

      return { x: newX, y: newY, width: newW, height: newH };
    },
    [naturalSize],
  );

  const handleRatioSelect = (newRatio: CropAspectRatio) => {
    setRatio(newRatio);
    setCropBox((prev) => applyRatioToBox(prev, newRatio));
  };

  const handleReset = () => {
    setRotation(0);
    setZoom(1);
    setRatio('1:1');
    if (naturalSize) {
      const imgAspect = naturalSize.width / naturalSize.height;
      if (imgAspect >= 1) {
        const w = 1 / imgAspect;
        setCropBox({ x: Math.max(0, (1 - w) / 2), y: 0.02, width: Math.min(0.96, w), height: 0.96 });
      } else {
        const h = imgAspect;
        setCropBox({ x: 0.02, y: Math.max(0, (1 - h) / 2), width: 0.96, height: Math.min(0.96, h) });
      }
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const startDrag = (
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w',
    clientX: number,
    clientY: number,
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      type,
      startX: clientX,
      startY: clientY,
      initialBox: { ...cropBox },
      containerRect: rect,
    };
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w',
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startDrag(type, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = (e.clientX - drag.startX) / drag.containerRect.width;
    const dy = (e.clientY - drag.startY) / drag.containerRect.height;
    const init = drag.initialBox;

    const next = { ...init };

    if (drag.type === 'move') {
      next.x = clamp(init.x + dx, 0, 1 - init.width);
      next.y = clamp(init.y + dy, 0, 1 - init.height);
    } else {
      const minSize = 0.15;
      if (drag.type.includes('e')) {
        next.width = clamp(init.width + dx, minSize, 1 - init.x);
      }
      if (drag.type.includes('s')) {
        next.height = clamp(init.height + dy, minSize, 1 - init.y);
      }
      if (drag.type.includes('w')) {
        const potentialW = clamp(init.width - dx, minSize, init.x + init.width);
        next.x = init.x + init.width - potentialW;
        next.width = potentialW;
      }
      if (drag.type.includes('n')) {
        const potentialH = clamp(init.height - dy, minSize, init.y + init.height);
        next.y = init.y + init.height - potentialH;
        next.height = potentialH;
      }

      if (ratio !== 'free' && naturalSize) {
        const imgAspect = naturalSize.width / naturalSize.height;
        let desired = 1;
        if (ratio === '3:4') desired = 3 / 4;
        else if (ratio === '4:3') desired = 4 / 3;

        const normRatio = desired / imgAspect;
        next.height = clamp(next.width / normRatio, minSize, 1 - next.y);
        next.width = next.height * normRatio;
      }
    }

    setCropBox(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_err) {
        void _err;
      }
      dragRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        pinchRef.current = { distance: dist, initialZoom: zoom };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const scale = dist / pinchRef.current.distance;
        setZoom(clamp(pinchRef.current.initialZoom * scale, 1, 3));
      }
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  useEffect(() => {
    if (!open || !imageSrc || !naturalSize || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    if (!img || !img.complete) return;

    const sx = cropBox.x * naturalSize.width;
    const sy = cropBox.y * naturalSize.height;
    const sw = cropBox.width * naturalSize.width;
    const sh = cropBox.height * naturalSize.height;
    if (sw <= 0 || sh <= 0) return;

    const maxPreview = 120;
    const cropAspect = sw / sh;
    const previewWidth = Math.max(1, Math.round(cropAspect >= 1 ? maxPreview : maxPreview * cropAspect));
    const previewHeight = Math.max(1, Math.round(cropAspect >= 1 ? maxPreview / cropAspect : maxPreview));
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    ctx.clearRect(0, 0, previewWidth, previewHeight);

    ctx.save();
    if (ratio === 'circle') {
      const radius = Math.min(previewWidth, previewHeight) / 2 - 2;
      ctx.beginPath();
      ctx.arc(previewWidth / 2, previewHeight / 2, radius, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, previewWidth, previewHeight);
    ctx.restore();
  }, [open, imageSrc, naturalSize, cropBox, ratio, rotation, zoom]);

  const handleConfirm = async () => {
    if (!imageSrc || !naturalSize) return;
    setProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto de canvas');

      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao decodificar imagem para recorte'));
        img.src = imageSrc;
      });

      const sx = Math.max(0, Math.round(cropBox.x * naturalSize.width));
      const sy = Math.max(0, Math.round(cropBox.y * naturalSize.height));
      const sw = Math.max(1, Math.min(naturalSize.width - sx, Math.round(cropBox.width * naturalSize.width)));
      const sh = Math.max(1, Math.min(naturalSize.height - sy, Math.round(cropBox.height * naturalSize.height)));

      const maxDimension = 512;
      const scale = maxDimension / Math.max(sw, sh);
      const outputWidth = Math.max(1, Math.round(sw * scale));
      const outputHeight = Math.max(1, Math.round(sh * scale));
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      if (ratio === 'circle') {
        ctx.beginPath();
        ctx.arc(outputWidth / 2, outputHeight / 2, Math.min(outputWidth, outputHeight) / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      if (rotation !== 0) {
        ctx.translate(outputWidth / 2, outputHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-outputWidth / 2, -outputHeight / 2);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

      const croppedDataUrl = canvas.toDataURL('image/png');
      onCropComplete({
        dataUrl: croppedDataUrl,
        width: outputWidth,
        height: outputHeight,
      });
      onClose();
    } catch (err) {
      console.error('Falha ao aplicar recorte', err);
    } finally {
      setProcessing(false);
    }
  };

  if (!open || !imageSrc) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-app animate-fade-in safe-top safe-bottom">
      {}
      <img
        ref={imageRef}
        src={imageSrc}
        alt=""
        className="hidden"
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        }}
      />

      {}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <IconButton label={t('common.cancel')} size="sm" onClick={onClose}>
            <X className="size-5" aria-hidden />
          </IconButton>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{t('editor.cropper.title')}</h2>
            <p className="text-[11px] text-ink-muted">{t('editor.properties.cropAndFrameButton')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            icon={<Undo2 className="size-3.5" aria-hidden />}
          >
            {t('editor.cropper.reset')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            loading={processing}
            icon={<Check className="size-4" aria-hidden />}
          >
            {t('common.save')}
          </Button>
        </div>
      </header>

      {}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={containerRef}
          className="checkerboard relative aspect-square max-h-full max-w-full select-none overflow-hidden rounded-[14px] border border-line shadow-2xl"
          style={{ width: 'min(86vw, 86dvh)', height: 'min(86vw, 86dvh)' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {}
          <img
            src={imageSrc}
            alt="Para recortar"
            className="pointer-events-none size-full object-contain"
            style={{
              transform: `rotate(${rotation}deg) scale(${zoom})`,
              transition: 'transform 0.15s ease-out',
            }}
          />

          {}
          <div
            className="pointer-events-none absolute inset-0 bg-black/55"
            style={{
              clipPath:
                ratio === 'circle'
                  ? `polygon(0% 0%, 0% 100%, ${cropBox.x * 100}% 100%, ${cropBox.x * 100}% ${cropBox.y * 100}%, ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%, ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%, ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%, ${cropBox.x * 100}% 100%, 100% 100%, 100% 0%)`
                  : `polygon(0% 0%, 0% 100%, ${cropBox.x * 100}% 100%, ${cropBox.x * 100}% ${cropBox.y * 100}%, ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%, ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%, ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%, ${cropBox.x * 100}% 100%, 100% 100%, 100% 0%)`,
            }}
          />

          {}
          <div
            className={cx(
              'absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-shadow',
              ratio === 'circle' ? 'rounded-full' : 'rounded-[2px]',
            )}
            style={{
              left: `${cropBox.x * 100}%`,
              top: `${cropBox.y * 100}%`,
              width: `${cropBox.width * 100}%`,
              height: `${cropBox.height * 100}%`,
              touchAction: 'none',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
          >
            {}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            {}
            <span
              className="-left-2 -top-2 absolute size-5 cursor-nwse-resize rounded-full border-2 border-white bg-black shadow-md active:scale-125"
              onPointerDown={(e) => handlePointerDown(e, 'nw')}
            />
            <span
              className="-right-2 -top-2 absolute size-5 cursor-nesw-resize rounded-full border-2 border-white bg-black shadow-md active:scale-125"
              onPointerDown={(e) => handlePointerDown(e, 'ne')}
            />
            <span
              className="-right-2 -bottom-2 absolute size-5 cursor-nwse-resize rounded-full border-2 border-white bg-black shadow-md active:scale-125"
              onPointerDown={(e) => handlePointerDown(e, 'se')}
            />
            <span
              className="-left-2 -bottom-2 absolute size-5 cursor-nesw-resize rounded-full border-2 border-white bg-black shadow-md active:scale-125"
              onPointerDown={(e) => handlePointerDown(e, 'sw')}
            />

            {}
            {ratio === 'free' && (
              <>
                <span
                  className="top-1/2 -left-1.5 -translate-y-1/2 absolute h-6 w-3 cursor-ew-resize rounded-full border border-white bg-black/80"
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                />
                <span
                  className="top-1/2 -right-1.5 -translate-y-1/2 absolute h-6 w-3 cursor-ew-resize rounded-full border border-white bg-black/80"
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                />
                <span
                  className="-top-1.5 left-1/2 -translate-x-1/2 absolute h-3 w-6 cursor-ns-resize rounded-full border border-white bg-black/80"
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                />
                <span
                  className="-bottom-1.5 left-1/2 -translate-x-1/2 absolute h-3 w-6 cursor-ns-resize rounded-full border border-white bg-black/80"
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                />
              </>
            )}
          </div>
        </div>

        {}
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-center gap-1 rounded-[14px] border border-line bg-surface/90 p-2 shadow-lg backdrop-blur">
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            {t('common.preview')}
          </span>
          <canvas
            ref={previewCanvasRef}
            className="size-16 rounded-[10px] border border-line/60 bg-black/50 object-contain shadow-inner"
          />
        </div>
      </div>

      {}
      <footer className="shrink-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[580px] flex-col gap-3">
          {}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-1">
              <IconButton label={t('editor.toolbar.zoomOut')} size="sm" onClick={() => setZoom((z) => clamp(z - 0.15, 1, 3))}>
                <Minus className="size-3.5" aria-hidden />
              </IconButton>
              <span className="min-w-[40px] text-center text-[11px] font-medium tabular-nums text-ink-muted">
                {Math.round(zoom * 100)}%
              </span>
              <IconButton label={t('editor.toolbar.zoomIn')} size="sm" onClick={() => setZoom((z) => clamp(z + 0.15, 1, 3))}>
                <Plus className="size-3.5" aria-hidden />
              </IconButton>
            </div>

            <Button
              variant="quiet"
              size="sm"
              onClick={handleRotate}
              icon={<RotateCw className="size-3.5" aria-hidden />}
            >
              {t('editor.cropper.rotate')}
            </Button>
          </div>

          {}
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: '1:1', label: t('editor.cropper.ratios.square'), icon: Crop },
                { id: 'free', label: t('editor.cropper.ratios.free'), icon: Maximize2 },
                { id: 'circle', label: t('editor.cropper.ratios.circle'), icon: Circle },
                { id: '3:4', label: t('editor.cropper.ratios.portrait'), icon: Crop },
                { id: '4:3', label: t('editor.cropper.ratios.landscape'), icon: Crop },
              ] as const
            ).map((opt) => {
              const active = ratio === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRatioSelect(opt.id)}
                  className={cx(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-2.5 py-2 text-[12px] font-medium transition-colors select-none',
                    active ? 'bg-ink text-app' : 'bg-surface-2 text-ink-muted hover:text-ink active:scale-95',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
