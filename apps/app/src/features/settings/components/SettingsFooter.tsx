import { AtSign, ExternalLink, Sticker } from 'lucide-react';
import { INSTAGRAM_HANDLE, INSTAGRAM_PROFILE_URL } from '@/config/attribution';
import { openExternalLink } from '@/services/native/externalLinks';
import { useTranslation } from '@/i18n';

export function SettingsFooter() {
  const { t } = useTranslation();

  return (
    <footer className="flex flex-col items-center justify-center border-t border-line/40 pt-6 text-center select-none">
      <span
        aria-hidden
        className="mb-3 flex size-11 items-center justify-center rounded-full border border-line bg-surface"
      >
        <Sticker className="size-5 text-ink-muted" />
      </span>
      <p className="text-[13px] font-semibold tracking-[0.08em] text-ink">Shappire Stickers</p>
      <p className="mt-1 text-[11.5px] text-ink-muted">
        {t('settings.developedBy')} <span className="text-ink-soft">Vassiliev</span>
      </p>
      <a
        href={INSTAGRAM_PROFILE_URL}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => {
          event.preventDefault();
          void openExternalLink(INSTAGRAM_PROFILE_URL);
        }}
        className="group mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink active:scale-[0.97] touch-manipulation"
      >
        <AtSign className="size-3.5 text-ink-muted transition-colors group-hover:text-ink" aria-hidden />
        <span className="tracking-wide underline-offset-4 group-hover:underline">Instagram: {INSTAGRAM_HANDLE}</span>
        <ExternalLink className="size-3 text-ink-muted" aria-hidden />
      </a>
    </footer>
  );
}
