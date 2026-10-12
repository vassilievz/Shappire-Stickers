import { ImagePlus, Images, Plus, Sparkles } from 'lucide-react';
import {
  DEFAULT_AUTHOR_DISPLAY_NAME,
  INSTAGRAM_HANDLE,
  INSTAGRAM_LABEL,
  INSTAGRAM_PROFILE_URL,
} from '@/config/attribution';
import type { StickerPack, StickerRecord } from '@/domain/stickerPack';
import { openExternalLink } from '@/services/native/externalLinks';
import { Button } from '@/shared/components/primitives';
import { BottomSheet } from '@/shared/components/overlays';
import { BlurFade } from '@/shared/components/motion';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { StickerPreview } from '../StickerPreview';
import { SheetActionRow } from './SheetActionRow';

export function PackDetailStickerSheet({
  open,
  pack,
  sticker,
  authorDisplayName,
  onClose,
  onUseAsTray,
  onEditMeta,
  onShare,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: {
  open: boolean;
  pack: StickerPack;
  sticker: StickerRecord | null;
  authorDisplayName: string;
  onClose: () => void;
  onUseAsTray: (sticker: StickerRecord) => void;
  onEditMeta: (sticker: StickerRecord) => void;
  onShare: (sticker: StickerRecord) => void;
  onMoveLeft: (sticker: StickerRecord) => void;
  onMoveRight: (sticker: StickerRecord) => void;
  onRemove: (stickerId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} title={sticker ? t('packDetail.sheetStickerTitle') : undefined} onClose={onClose}>
      {sticker ? (
        <div className="flex flex-col gap-4 pb-2">
          <BlurFade durationMs={260} className="flex justify-center">
            <div
              className={cx(
                'checkerboard relative w-full max-w-[240px] overflow-hidden rounded-[18px] border border-line bg-surface-2/40 shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
                !sticker.isAnimated && 'animate-blur-fade',
              )}
            >
              <StickerPreview
                packId={pack.id}
                fileName={sticker.fileName}
                isAnimated={sticker.isAnimated}
                className="aspect-square size-full object-contain"
              />
            </div>
          </BlurFade>

          <div className="flex flex-col items-center gap-2.5 pb-1 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[13px] text-ink-soft">
              <span className="font-medium text-ink">
                {authorDisplayName.trim() || DEFAULT_AUTHOR_DISPLAY_NAME}
              </span>
              <span aria-hidden className="text-ink-muted">·</span>
              <span className="text-ink-muted">{INSTAGRAM_LABEL}</span>
              <span aria-hidden className="text-ink-muted">·</span>
              <a
                href={INSTAGRAM_PROFILE_URL}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => {
                  event.preventDefault();
                  openExternalLink(INSTAGRAM_PROFILE_URL);
                }}
                className="group inline-flex min-h-[32px] items-center rounded-[8px] px-1.5 -mx-1.5 font-medium text-ink underline-offset-4 transition-colors hover:text-focus hover:underline focus-visible:outline-2 active:scale-[0.97] touch-manipulation"
              >
                {INSTAGRAM_HANDLE}
              </a>
            </p>
            {sticker.isAnimated ? (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Sparkles className="size-3" aria-hidden />
                {t('packDetail.animatedInfo')} ·{' '}
                {sticker.durationMs ? `${(sticker.durationMs / 1000).toFixed(1)}s` : 'GIF'}
              </p>
            ) : null}
          </div>

          <div className="h-px bg-line/60" aria-hidden />

          <ul className="flex flex-col gap-1">
            <SheetActionRow label={t('packDetail.useAsTray')} onClick={() => onUseAsTray(sticker)} />
            <SheetActionRow label={t('packDetail.editInfo')} onClick={() => onEditMeta(sticker)} />
            <SheetActionRow label={t('packDetail.shareSticker')} onClick={() => onShare(sticker)} />
            <SheetActionRow label={t('packDetail.moveLeft')} onClick={() => onMoveLeft(sticker)} />
            <SheetActionRow label={t('packDetail.moveRight')} onClick={() => onMoveRight(sticker)} />
            <SheetActionRow
              label={t('packDetail.removeFromPack')}
              tone="danger"
              onClick={() => onRemove(sticker.id)}
            />
          </ul>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function PackDetailAddSheet({
  open,
  busy,
  onClose,
  onCreateInEditor,
  onImportImage,
  onBatchImport,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreateInEditor: () => void;
  onImportImage: () => void;
  onBatchImport: () => void;
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} title={t('packDetail.addStickers')} onClose={onClose}>
      <div className="flex flex-col gap-2 pb-3">
        <Button
          variant="primary"
          fullWidth
          icon={<Plus className="size-4" aria-hidden />}
          onClick={onCreateInEditor}
        >
          {t('packDetail.createInEditor')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          icon={<ImagePlus className="size-4" aria-hidden />}
          onClick={onImportImage}
          loading={busy}
        >
          {t('packDetail.importFromGallery')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          icon={<Images className="size-4" aria-hidden />}
          onClick={onBatchImport}
          loading={busy}
        >
          {t('packDetail.batchImport')}
        </Button>
      </div>
    </BottomSheet>
  );
}
