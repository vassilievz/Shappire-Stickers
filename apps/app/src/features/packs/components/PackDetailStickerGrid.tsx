import { ImagePlus, Plus } from 'lucide-react';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import type { StickerPack, StickerRecord } from '@/domain/stickerPack';
import { Button, EmptyState, SectionTitle } from '@/shared/components/primitives';
import { formatBytes } from '@/shared/utils/format';
import { useTranslation } from '@/i18n';
import { StickerPreview } from '../StickerPreview';

export function PackDetailStickerGrid({
  pack,
  onAdd,
  onSelectSticker,
}: {
  pack: StickerPack;
  onAdd: () => void;
  onSelectSticker: (sticker: StickerRecord) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title={t('packDetail.stickersSection')}
        description={`${pack.stickers.length} / ${WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK}`}
        action={
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" aria-hidden />
            {t('packDetail.add')}
          </Button>
        }
      />

      {pack.stickers.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="size-6" aria-hidden />}
          title={t('packDetail.emptyTitle')}
          description={t('packDetail.emptyDesc')}
          action={
            <Button variant="primary" fullWidth onClick={onAdd}>
              {t('packDetail.addStickers')}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3.5">
          {pack.stickers.map((sticker, index) => (
            <li key={sticker.id} className="relative">
              <button
                type="button"
                onClick={() => onSelectSticker(sticker)}
                className="group block w-full text-left touch-manipulation transition-transform duration-150 active:scale-[0.96]"
              >
                <span className="checkerboard relative block aspect-square w-full overflow-hidden rounded-[12px] border border-line transition-[border-color,transform] duration-150 group-hover:border-focus/40 group-hover:scale-[1.02]">
                  <StickerPreview
                    packId={pack.id}
                    fileName={sticker.fileName}
                    isAnimated={sticker.isAnimated}
                    className="size-full object-contain"
                  />
                  {sticker.isAnimated ? (
                    <span className="absolute top-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white shadow-sm">
                      GIF
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-center text-[11px] tabular-nums text-ink-muted">
                  {index + 1} · {formatBytes(sticker.sizeBytes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
