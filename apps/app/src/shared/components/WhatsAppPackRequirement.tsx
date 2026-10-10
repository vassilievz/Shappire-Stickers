import { MessageCircle } from 'lucide-react';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { useTranslation } from '@/i18n';
import { cx } from '@/shared/utils/cx';

type CalloutVariant = 'default' | 'compact' | 'inline';

export function WhatsAppPackRequirementCallout({
  variant = 'default',
  className,
}: {
  variant?: CalloutVariant;
  className?: string;
}) {
  const { t } = useTranslation();
  const min = WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
  const max = WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK;

  if (variant === 'inline') {
    return (
      <p className={cx('text-[11.5px] leading-relaxed text-ink-muted', className)}>
        {t('whatsapp.minPackRuleInline', { min, max })}
      </p>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cx(
          'rounded-[var(--radius-control)] border border-line bg-surface-2/70 px-3 py-2.5 text-left',
          className,
        )}
      >
        <p className="text-[12px] font-semibold text-ink">{t('whatsapp.minPackRuleTitle', { min })}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
          {t('whatsapp.minPackRuleBody', { min, max })}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cx(
        'flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2/60 p-3.5 sm:p-4',
        className,
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-accent/10 text-accent"
        aria-hidden
      >
        <MessageCircle className="size-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-[13px] font-semibold leading-snug text-ink">
          {t('whatsapp.minPackRuleTitle', { min })}
        </p>
        <p className="text-[12px] leading-relaxed text-ink-muted">
          {t('whatsapp.minPackRuleBody', { min, max })}
        </p>
      </div>
    </div>
  );
}

export function PackWhatsAppProgressBar({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const min = WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
  const max = WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK;
  const ready = count >= min;
  const progress = Math.min(100, Math.round((count / min) * 100));

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="text-[11px] leading-snug text-ink-muted">
        {ready
          ? t('whatsapp.packProgressReady', { count, max })
          : t('whatsapp.packProgressNeedMore', {
              count,
              max,
              remaining: Math.max(0, min - count),
            })}
      </span>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={min}
        aria-valuenow={Math.min(count, min)}
        aria-label={t('whatsapp.packProgressAria', { count, min })}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-300', ready ? 'bg-success' : 'bg-accent')}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
