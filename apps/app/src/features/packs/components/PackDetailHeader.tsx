import { ArrowLeft, Download, Pencil } from 'lucide-react';
import { formatRelative } from '@/shared/utils/format';
import { useTranslation } from '@/i18n';
import type { StickerPack } from '@/domain/stickerPack';

export function PackDetailHeader({
  pack,
  onBack,
  onExportZip,
  onRename,
}: {
  pack: StickerPack;
  onBack: () => void;
  onExportZip: () => void;
  onRename: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        aria-label={t('common.back')}
        onClick={onBack}
        className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 touch-manipulation"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">{pack.name}</h1>
        <p className="truncate text-[12px] text-ink-muted">
          {pack.publisher} · {t('packDetail.updated', { time: formatRelative(pack.updatedAt) })}
        </p>
      </div>
      <button
        type="button"
        aria-label={t('packDetail.exportZip')}
        onClick={onExportZip}
        title={t('packDetail.exportZip')}
        className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 touch-manipulation"
      >
        <Download className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t('packDetail.editPackTitle')}
        onClick={onRename}
        className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 touch-manipulation"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
    </header>
  );
}
