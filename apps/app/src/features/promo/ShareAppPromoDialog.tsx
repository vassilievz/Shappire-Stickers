import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  ExternalLink,
  MessageCircle,
  Share2,
  Sparkles,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { APP_INFO } from '@/config/app';
import { useTranslation } from '@/i18n';
import { shareText } from '@/services/native/shareService';
import { writeClipboardText } from '@/services/native/clipboard';
import { showToast } from '@/state/toastStore';
import { Button } from '@/shared/components/primitives';
import { DotPattern } from '@/shared/components/motion';
import { cx } from '@/shared/utils/cx';
import {
  dismissSharePromoPermanent,
  snoozeSharePromo,
} from './shareAppPromoStorage';

export interface ShareAppPromoDialogProps {
  open: boolean;
  onClose: () => void;
}

function useOverlayBehavior(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [open, onClose]);
}

function BenefitRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-soft">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line/80 bg-surface-2 text-accent">
        {icon}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

export function ShareAppPromoDialog({ open, onClose }: ShareAppPromoDialogProps) {
  const { t } = useTranslation();
  const downloadUrl = APP_INFO.publicDownloadUrl;

  const handleCloseLater = () => {
    snoozeSharePromo();
    onClose();
  };

  const handleDismissForever = () => {
    dismissSharePromoPermanent();
    onClose();
  };

  const handleShare = async () => {
    const text = t('sharePromo.shareMessage', { url: downloadUrl });
    try {
      await shareText({ title: t('sharePromo.shareTitle'), text });
    } catch {
      const copied = await writeClipboardText(text);
      if (copied) {
        showToast(t('invites.copied'), 'success');
      }
    }
  };

  const handleCopyLink = async () => {
    const copied = await writeClipboardText(downloadUrl);
    if (copied) {
      showToast(t('sharePromo.linkCopied'), 'success');
    }
  };

  useOverlayBehavior(open, handleCloseLater);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:items-center sm:p-6 animate-fade-in">
      <button
        type="button"
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
        onClick={handleCloseLater}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-promo-title"
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_28px_80px_rgba(0,0,0,0.55)] animate-fade-in-up"
      >
        <div className="relative overflow-hidden bg-gradient-to-b from-[#14161c] via-[#0f1014] to-surface px-5 pb-6 pt-5">
          <DotPattern className="absolute inset-0 opacity-[0.14]" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-accent/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-6 bottom-0 size-32 rounded-full bg-white/10 blur-2xl"
          />

          <button
            type="button"
            onClick={handleCloseLater}
            aria-label={t('common.close')}
            className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/35 active:scale-95 touch-manipulation"
          >
            <X className="size-4" aria-hidden />
          </button>

          <div className="relative flex flex-col items-center gap-3 pt-2 text-center">
            <div
              className="flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              aria-hidden
            >
              <svg viewBox="0 0 32 32" className="size-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 7L23 7L28 14L16 27L4 14L9 7Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <path d="M4 14H28" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
                <path
                  d="M9 7L13 14L16 27L19 14L23 7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {t('sharePromo.eyebrow')}
              </p>
              <h2 id="share-promo-title" className="text-[20px] font-semibold tracking-[-0.02em] text-white">
                {t('sharePromo.title')}
              </h2>
              <p className="max-w-[30ch] text-[13px] leading-relaxed text-white/75">{t('sharePromo.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-5">
          <p className="text-[14px] leading-relaxed text-ink-muted">{t('sharePromo.description')}</p>

          <ul className="flex flex-col gap-2.5" aria-label={t('sharePromo.benefitsLabel')}>
            <BenefitRow icon={<Smartphone className="size-3.5" aria-hidden />}>
              {t('sharePromo.bulletFree')}
            </BenefitRow>
            <BenefitRow icon={<Sparkles className="size-3.5" aria-hidden />}>
              {t('sharePromo.bulletCreate')}
            </BenefitRow>
            <BenefitRow icon={<Users className="size-3.5" aria-hidden />}>
              {t('sharePromo.bulletCommunity')}
            </BenefitRow>
          </ul>

          <div className="rounded-[14px] border border-line bg-surface-2 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {t('sharePromo.downloadLabel')}
            </p>
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-line/80 bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface active:scale-[0.99] touch-manipulation"
              onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-accent">{downloadUrl}</span>
              <ExternalLink className="size-4 shrink-0 text-ink-muted" aria-hidden />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full"
              icon={<Share2 className="size-4" aria-hidden />}
              onClick={() => void handleShare()}
            >
              {t('sharePromo.shareButton')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              icon={<Copy className="size-4" aria-hidden />}
              onClick={() => void handleCopyLink()}
            >
              {t('sharePromo.copyLink')}
            </Button>
          </div>

          <div className="rounded-[14px] border border-dashed border-line/90 bg-surface-2/60 px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-ink-muted">{t('sharePromo.discordHint')}</p>
            <button
              type="button"
              className={cx(
                'mt-2 inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold text-accent',
                'transition-opacity hover:opacity-90 active:scale-[0.99] touch-manipulation',
              )}
              onClick={() => window.open(APP_INFO.discordCommunityUrl, '_blank', 'noopener,noreferrer')}
            >
              <MessageCircle className="size-4" aria-hidden />
              {t('sharePromo.discordCta')}
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 pt-1">
            <button
              type="button"
              className="min-h-[44px] px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink touch-manipulation"
              onClick={handleCloseLater}
            >
              {t('sharePromo.later')}
            </button>
            <button
              type="button"
              className="min-h-[40px] px-3 text-[12px] text-ink-muted/80 underline-offset-2 hover:text-ink-muted hover:underline touch-manipulation"
              onClick={handleDismissForever}
            >
              {t('sharePromo.dontShowAgain')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
