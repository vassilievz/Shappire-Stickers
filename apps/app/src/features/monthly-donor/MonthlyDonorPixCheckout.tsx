import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ArrowLeft, Loader2 } from 'lucide-react';
import { Button, Card } from '@/shared/components/primitives';
import { writeClipboardText } from '@/services/native/clipboard';
import { showToast } from '@/state/toastStore';
import { getMonthlyDonorChargeStatus } from '@/services/api/monthlyDonorApi';
import { useProfileStore } from '@/state/profileStore';
import { useTranslation } from '@/i18n';
import type { MonthlyDonorChargeCreateResponse } from '@shappire/contracts';

interface MonthlyDonorPixCheckoutProps {
  charge: MonthlyDonorChargeCreateResponse;
  onCancel: () => void;
  onSuccess: () => void;
}

const POLLING_INTERVAL_MS = 4500;

export function MonthlyDonorPixCheckout({ charge, onCancel, onSuccess }: MonthlyDonorPixCheckoutProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(charge.status === 'PAID');
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCopy = async () => {
    try {
      await writeClipboardText(charge.copyPaste);
      setCopied(true);
      showToast(t('monthlyDonor.copiedSuccess'), 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast(t('monthlyDonor.copiedError'), 'error');
    }
  };

  useEffect(() => {
    if (isPaid) return;

    const checkStatus = async () => {
      try {
        setIsChecking(true);
        const res = await getMonthlyDonorChargeStatus(charge.chargeId);
        if (res.status === 'PAID') {
          setIsPaid(true);
          void useProfileStore.getState().hydrate();
          showToast(t('monthlyDonor.paidSuccess'), 'success');
        }
      } catch {
        // polling silencioso
      } finally {
        setIsChecking(false);
      }
    };

    void checkStatus();
    timerRef.current = setInterval(() => void checkStatus(), POLLING_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [charge.chargeId, isPaid, t]);

  if (isPaid) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-line bg-surface-2 text-accent">
          <Check className="size-8" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-ink">{t('monthlyDonor.paidTitle')}</h2>
        <p className="text-sm text-ink-muted">{t('monthlyDonor.paidSuccess')}</p>
        <Button variant="primary" fullWidth onClick={onSuccess}>{t('monthlyDonor.continue')}</Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <Button variant="ghost" size="sm" className="self-start" onClick={onCancel} icon={<ArrowLeft className="size-4" />}>
        {t('common.back')}
      </Button>
      <p className="text-sm text-ink-muted">{t('monthlyDonor.scanQr')}</p>
      <div className="flex justify-center rounded-xl border border-line bg-white p-4">
        <QRCodeSVG value={charge.copyPaste} size={200} aria-label={t('monthlyDonor.qrAria')} />
      </div>
      <p className="break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-soft">
        {charge.copyPaste}
      </p>
      <Button variant="secondary" fullWidth onClick={() => void handleCopy()} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
        {t('monthlyDonor.copyPix')}
      </Button>
      <p className="flex items-center justify-center gap-2 text-[13px] text-ink-muted">
        {isChecking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('monthlyDonor.waitingPayment')}
      </p>
    </Card>
  );
}
