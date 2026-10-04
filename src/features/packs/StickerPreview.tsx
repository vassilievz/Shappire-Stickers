import { useEffect, useState } from 'react';
import { useLibraryStore } from '@/state/libraryStore';
import { cx } from '@/shared/utils/cx';

export interface StickerPreviewProps {
  packId: string;
  fileName: string;
  className?: string;
  isAnimated?: boolean;
}

export function StickerPreview({
  packId,
  fileName,
  className,
  isAnimated = false,
}: StickerPreviewProps) {
  const getStickerPreview = useLibraryStore((state) => state.getStickerPreview);
  const cached = useLibraryStore(
    (state) => state.stickerPreviews[`${packId}/${fileName}`] ?? null,
  );
  const [fetched, setFetched] = useState<string | null>(null);
  const src = cached ?? fetched;

  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    void getStickerPreview(packId, fileName).then((value) => {
      if (active) setFetched(value);
    });
    return () => {
      active = false;
    };
  }, [cached, fileName, getStickerPreview, packId]);

  if (!src) {
    return <span aria-hidden className={cx('block bg-surface-2', className)} />;
  }

  return (
    <div className="relative size-full">
      <img src={src} alt="" className={cx('size-full object-contain', className)} loading="lazy" />
      {isAnimated ? (
        <span className="absolute bottom-1 right-1 rounded-[4px] border border-white/20 bg-black/80 px-1 py-0.5 text-[9px] font-bold tracking-wider text-white shadow-sm backdrop-blur-[2px]">
          GIF
        </span>
      ) : null}
    </div>
  );
}
