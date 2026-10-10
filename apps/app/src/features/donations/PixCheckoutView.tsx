import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button, Card } from '@/shared/components/primitives';
import { writeClipboardText } from '@/services/native/clipboard';
import { showToast } from '@/state/toastStore';
import { getDonationStatus } from '@/services/api/donationApi';
import { useProfileStore } from '@/state/profileStore';
import { logAnalyticsEvent } from '@/services/firebase';
import { InitialSupporterIcon } from '@/features/profile/components/InitialSupporterBadge';
import { useTranslation } from '@/i18n';
import type { DonationCreateResponse } from '@shappire/contracts';

interface PixCheckoutViewProps {
  donation: DonationCreateResponse;
  onCancel: () => void;
  onSuccess: () => void;
}

const POLLING_INTERVAL_MS = 4500;

export function PixCheckoutView({ donation, onCancel, onSuccess }: PixCheckoutViewProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(donation.status === 'PAID');
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCopy = async () => {
    try {
      await writeClipboardText(donation.copyPaste);
      setCopied(true);
      showToast(t('donations.copiedSuccessDesc'), 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast(t('donations.copiedError'), 'error');
    }
  };

  useEffect(() => {
    if (isPaid) return;

    const checkStatus = async () => {
      try {
        setIsChecking(true);
        const res = await getDonationStatus(donation.donationId);
        if (res.status === 'PAID') {
          setIsPaid(true);
          // Atualiza perfil no cache e store
          void useProfileStore.getState().hydrate();
          void logAnalyticsEvent('donation_completed', { amount: donation.amount });
          showToast(t('donations.paidSuccessDesc'), 'success');
        }
      } catch {
        // Erros transitórios de rede ignorados no polling silencioso
      } finally {
        setIsChecking(false);
      }
    };

    timerRef.current = setInterval(() => {
      void checkStatus();
    }, POLLING_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [donation.donationId, donation.amount, isPaid, t]);

  if (isPaid) {
    return (
      <Card className="flex flex-col items-center p-6 text-center">
        <div className="relative mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 p-4 border border-indigo-500/30">
          <InitialSupporterIcon size="xl" className="animate-pulse" />
          <Sparkles className="absolute -top-1 -right-1 size-6 text-amber-400" />
        </div>

        <h2 className="text-[22px] font-bold tracking-tight text-ink">
          {t('donations.paidSuccessTitle')}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted max-w-[34ch]">
          {t('donations.paidCelebrationMessage')}
        </p>

        <div className="mt-6 w-full">
          <Button variant="primary" size="lg" fullWidth onClick={onSuccess}>
            {t('donations.viewProfileButton')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>{t('common.back')}</span>
        </button>
        <span className="text-[14px] font-bold text-ink">
          R$ {donation.amount.toFixed(2).replace('.', ',')}
        </span>
      </div>

      <Card className="flex flex-col items-center p-6">
        <p className="text-[13px] font-medium text-ink-muted mb-4 text-center">
          {t('donations.scanQrInstructions')}
        </p>

        {/* QR Code renderizado no client via SVG seguro */}
        <div className="rounded-[18px] bg-white p-4 shadow-sm border border-black/5">
          <QRCodeSVG
            value={donation.copyPaste}
            size={220}
            level="M"
            marginSize={1}
            aria-label={t('donations.qrCodeAriaLabel')}
          />
        </div>

        <div className="mt-5 flex items-center gap-2 text-[13px] font-medium text-ink-muted">
          <Loader2 className="size-4 animate-spin text-indigo-500" />
          <span>
            {isChecking ? t('donations.checkingPayment') : t('donations.waitingPayment')}
          </span>
        </div>

        <div className="mt-5 w-full">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleCopy}
            icon={
              copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )
            }
          >
            {copied ? t('donations.pixCopied') : t('donations.copyPixCode')}
          </Button>
        </div>
      </Card>

      <div className="rounded-[14px] border border-line bg-surface-2/40 p-4 text-[12px] leading-relaxed text-ink-muted">
        <p className="font-semibold text-ink">{t('donations.paymentInstructionsTitle')}:</p>
        <ol className="mt-1.5 list-decimal pl-4 space-y-1">
          <li>{t('donations.step1')}</li>
          <li>{t('donations.step2')}</li>
          <li>{t('donations.step3')}</li>
        </ol>
      </div>
    </div>
  );
}
