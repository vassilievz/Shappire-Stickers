import { Badge } from '@/shared/components/primitives';
import { BlurFade } from '@/shared/components/motion';
import type { StickerPack } from '@/domain/stickerPack';
import type { ValidationResult } from '@/domain/validation/whatsappRules';
import { useTranslation } from '@/i18n';
import { StickerPreview } from '../StickerPreview';

export function PackDetailStatsCard({
  pack,
  packReady,
  rulesValidation,
}: {
  pack: StickerPack;
  packReady: boolean;
  rulesValidation: ValidationResult | null;
}) {
  const { t } = useTranslation();

  return (
    <BlurFade durationMs={280} delayMs={60}>
      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <span className="checkerboard size-16 shrink-0 overflow-hidden rounded-[12px] border border-line">
          {pack.trayImage ? (
            <StickerPreview
              packId={pack.id}
              fileName={pack.trayImage.fileName}
              className="size-full object-contain"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t('packDetail.stickersBadge', { count: pack.stickers.length })}</Badge>
            {pack.stickerType === 'animated' ? (
              <Badge tone="neutral">{t('packDetail.animatedBadge')}</Badge>
            ) : null}
            <Badge tone="neutral">v{pack.imageDataVersion}</Badge>
            <Badge tone={packReady ? 'success' : 'warning'}>
              {packReady ? t('packDetail.readyToSend') : t('packDetail.pending')}
            </Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {packReady
              ? t('packDetail.meetsRequirements')
              : (rulesValidation?.errors[0]?.message ?? t('packDetail.pending'))}
          </p>
        </div>
      </section>
    </BlurFade>
  );
}
