import { useEffect, useState } from 'react';
import { ExternalLink, Share2 } from 'lucide-react';
import { APP_INFO } from '@/config/app';
import { useTranslation } from '@/i18n';
import { shareText } from '@/services/native/shareService';
import { writeClipboardText } from '@/services/native/clipboard';
import { showToast } from '@/state/toastStore';
import { Button } from '@/shared/components/primitives';
import { Modal } from '@/shared/components/overlays';
import { dismissSharePromoPermanent } from './shareAppPromoStorage';

export interface ShareAppPromoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareAppPromoDialog({ open, onClose }: ShareAppPromoDialogProps) {
  const { t } = useTranslation();
  const downloadUrl = APP_INFO.publicDownloadUrl;
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  const finalizeClose = () => {
    if (dontShowAgain) {
      dismissSharePromoPermanent();
    }
    onClose();
  };

  const handleShare = async () => {
    const text = t('sharePromo.shareMessage', { url: downloadUrl });
    try {
      await shareText({ title: t('sharePromo.shareTitle'), text });
      finalizeClose();
    } catch {
      const copied = await writeClipboardText(text);
      if (copied) {
        showToast(t('sharePromo.linkCopied'), 'success');
        finalizeClose();
      }
    }
  };

  return (
    <Modal
      open={open}
      title={t('sharePromo.title')}
      description={t('sharePromo.description')}
      onClose={finalizeClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={finalizeClose}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            icon={<Share2 className="size-4" aria-hidden />}
            onClick={() => void handleShare()}
          >
            {t('sharePromo.shareButton')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3.5 text-left transition-colors hover:bg-surface-3/80 active:scale-[0.99] touch-manipulation"
          onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent">
            <Share2 className="size-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">{t('sharePromo.downloadLabel')}</span>
            <span className="mt-0.5 block truncate text-[13px] text-ink-muted">{t('sharePromo.downloadHost')}</span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-ink-muted" aria-hidden />
        </button>

        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] px-0.5 py-1 touch-manipulation">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="mt-0.5 size-[18px] shrink-0 rounded border-line bg-surface-2 accent-[var(--color-accent)]"
          />
          <span className="text-[13px] leading-snug text-ink-muted">{t('sharePromo.dontShowAgain')}</span>
        </label>
      </div>
    </Modal>
  );
}
