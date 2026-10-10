import { Download, RefreshCw, Store, X } from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import { useAppUpdateStore, isUpdateBannerDismissed } from '@/state/appUpdateStore';
import { cx } from '@/shared/utils/cx';

export function AppUpdateBanner() {
  const { t } = useTranslation();
  const otaState = useAppUpdateStore((s) => s.otaState);
  const otaVersion = useAppUpdateStore((s) => s.otaVersion);
  const otaError = useAppUpdateStore((s) => s.otaError);
  const storeState = useAppUpdateStore((s) => s.storeState);
  const storeLatestVersion = useAppUpdateStore((s) => s.storeLatestVersion);
  const storeReleaseNotes = useAppUpdateStore((s) => s.storeReleaseNotes);
  const dismissedKey = useAppUpdateStore((s) => s.dismissedKey);
  const downloadOta = useAppUpdateStore((s) => s.downloadOta);
  const applyOta = useAppUpdateStore((s) => s.applyOta);
  const dismissForVersion = useAppUpdateStore((s) => s.dismissForVersion);
  const openPlayStore = useAppUpdateStore((s) => s.openPlayStore);
  const checkForUpdates = useAppUpdateStore((s) => s.checkForUpdates);

  const showStore = storeState === 'available' || storeState === 'required';
  const showOta =
    otaState === 'available' || otaState === 'downloading' || otaState === 'ready' || otaState === 'error';

  if (!showStore && !showOta) return null;

  const dismissKey = showStore
    ? `store:${storeLatestVersion ?? 'unknown'}`
    : `ota:${otaVersion ?? 'unknown'}`;

  if (dismissedKey === dismissKey || isUpdateBannerDismissed(dismissKey)) {
    if (storeState !== 'required') return null;
  }

  const title = showStore
    ? storeState === 'required'
      ? t('updates.storeRequiredTitle')
      : t('updates.storeAvailableTitle', { version: storeLatestVersion ?? '' })
    : otaState === 'ready'
      ? t('updates.otaReadyTitle', { version: otaVersion ?? '' })
      : t('updates.otaAvailableTitle', { version: otaVersion ?? '' });

  const description = showStore
    ? storeReleaseNotes ?? t('updates.storeAvailableDesc')
    : otaState === 'error'
      ? otaError ?? t('updates.otaError')
      : t('updates.otaAvailableDesc');

  return (
    <div
      className={cx(
        'mb-3 rounded-[var(--radius-card)] border border-line bg-surface-2 px-3.5 py-3 shadow-sm',
        storeState === 'required' && 'border-warning/40',
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent">
          {showStore ? <Store className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{description}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {showStore ? (
              <Button type="button" size="sm" variant="primary" onClick={openPlayStore}>
                {t('updates.openPlayStore')}
              </Button>
            ) : null}
            {showOta && otaState === 'available' ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => void downloadOta()}>
                {t('updates.downloadOta')}
              </Button>
            ) : null}
            {showOta && otaState === 'downloading' ? (
              <Button type="button" size="sm" variant="secondary" loading disabled>
                {t('updates.downloading')}
              </Button>
            ) : null}
            {showOta && otaState === 'ready' ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                icon={<RefreshCw className="size-3.5" aria-hidden />}
                onClick={() => void applyOta()}
              >
                {t('updates.applyOta')}
              </Button>
            ) : null}
            {showOta && otaState === 'error' ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => void checkForUpdates({ force: true })}>
                {t('common.retry')}
              </Button>
            ) : null}
          </div>
        </div>
        {storeState !== 'required' ? (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink touch-manipulation"
            aria-label={t('common.close')}
            onClick={() => dismissForVersion(dismissKey)}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
