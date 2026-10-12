import { Check, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { Button, SectionTitle } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import type { WhatsAppCapabilities } from '@/services/whatsapp/whatsappService';

export function PackDetailWhatsAppSection({
  capabilities,
  whatsappInstalled,
  packReady,
  nativeValidation,
  addedState,
  busy,
  onValidate,
  onAddToWhatsApp,
  onOpenWhatsAppStore,
}: {
  capabilities: WhatsAppCapabilities | null;
  whatsappInstalled: boolean;
  packReady: boolean;
  nativeValidation: string[] | null;
  addedState: { consumer: boolean | null; business: boolean | null } | null;
  busy: boolean;
  onValidate: () => void;
  onAddToWhatsApp: () => void;
  onOpenWhatsAppStore: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title={t('packDetail.sendToWhatsApp')}
        description={
          capabilities && !capabilities.nativeAvailable ? t('packDetail.nativeOnly') : undefined
        }
      />

      {nativeValidation && nativeValidation.length > 0 ? (
        <ul className="rounded-[var(--radius-control)] border border-warning/30 bg-warning/10 px-3.5 py-3">
          {nativeValidation.map((message) => (
            <li key={message} className="text-[12px] leading-relaxed text-warning">
              • {message}
            </li>
          ))}
        </ul>
      ) : null}

      {capabilities && !whatsappInstalled ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-ink-soft">{t('packDetail.whatsAppNotInstalled')}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenWhatsAppStore}
            icon={<MessageCircle className="size-4" aria-hidden />}
          >
            {t('packDetail.installWhatsApp')}
          </Button>
        </div>
      ) : null}

      {addedState && (addedState.consumer || addedState.business) ? (
        <p className="flex items-center gap-2 text-[12px] text-success">
          <Check className="size-3.5" aria-hidden />
          {addedState.consumer && addedState.business
            ? t('packDetail.alreadyAddedBoth')
            : addedState.consumer
              ? t('packDetail.alreadyAddedConsumer')
              : t('packDetail.alreadyAddedBusiness')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={onValidate}
          loading={busy}
          icon={<RefreshCw className="size-4 shrink-0" aria-hidden />}
          className="min-w-0"
        >
          <span className="truncate">{t('packDetail.verify')}</span>
        </Button>
        <Button
          variant="primary"
          onClick={onAddToWhatsApp}
          loading={busy}
          disabled={!packReady || (capabilities !== null && !whatsappInstalled)}
          icon={<Share2 className="size-4 shrink-0" aria-hidden />}
          className="min-w-0"
        >
          <span className="truncate">{t('packDetail.add')}</span>
        </Button>
      </div>
      {!packReady ? (
        <p className="text-[12px] leading-relaxed text-ink-muted">
          {t('packDetail.minStickersHint', { min: WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK })}
        </p>
      ) : null}
    </section>
  );
}
