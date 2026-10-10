import { useState } from 'react';
import { REPORT_REASONS } from '@shappire/contracts';
import { BottomSheet } from '@/shared/components/overlays';
import { Button } from '@/shared/components/primitives';
import { TextArea } from '@/shared/components/inputs';
import { useTranslation } from '@/i18n';
import { submitReport } from '@/services/api/socialApi';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

export interface ReportTarget {
  targetType: 'publication' | 'comment' | 'user';
  targetId: string;
}

interface ReportSheetProps {
  open: boolean;
  target: ReportTarget | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ReportSheet({ open, target, onClose, onSubmitted }: ReportSheetProps) {
  const { t } = useTranslation();
  const defaultReason = REPORT_REASONS[0] ?? 'other';
  const [reason, setReason] = useState<string>(defaultReason);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(defaultReason);
    setDetails('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      await submitReport({
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
        details: details.trim() || undefined,
      });
      showToast(t('community.reportSuccess'), 'success');
      onSubmitted?.();
      reset();
      onClose();
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} title={t('community.reportTitle')} onClose={handleClose}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[13px] leading-relaxed text-ink-muted">{t('community.reportDesc')}</p>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-ink">{t('community.reportReason')}</legend>
          {REPORT_REASONS.map((key) => (
            <label
              key={key}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3"
            >
              <input
                type="radio"
                name="report-reason"
                value={key}
                checked={reason === key}
                onChange={() => setReason(key)}
                className="size-4 accent-accent"
              />
              <span className="text-[13px] text-ink-soft">{t(`community.reportReasons.${key}`)}</span>
            </label>
          ))}
        </fieldset>
        <TextArea
          label={t('community.reportDetails')}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          hint={t('community.reportDetailsOptional')}
        />
        <Button type="button" className="w-full" loading={submitting} onClick={() => void handleSubmit()}>
          {t('community.reportSubmit')}
        </Button>
      </div>
    </BottomSheet>
  );
}
