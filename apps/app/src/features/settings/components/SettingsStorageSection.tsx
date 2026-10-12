import { useEffect, useState } from 'react';
import { ChevronDown, HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { ConfirmDialog } from '@/shared/components/overlays';
import { formatBytes } from '@/shared/utils/format';
import {
  cleanAbandonedFiles,
  cleanRecreatableCache,
  computeStorageBreakdown,
  measureRecreatableCache,
  type StorageBreakdown,
} from '@/services/storage/storageStats';
import { useLibraryStore } from '@/state/libraryStore';
import { showToast } from '@/state/toastStore';
import { useTranslation } from '@/i18n';
import { GroupLabel, SettingsCard } from './SettingsLayout';

type CleanupKind = 'cache' | 'temp';

export function SettingsStorageSection() {
  const { t } = useTranslation();
  const invalidatePreviewCaches = useLibraryStore((state) => state.invalidatePreviewCaches);
  const refreshLibrary = useLibraryStore((state) => state.refresh);

  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [cleanupKind, setCleanupKind] = useState<CleanupKind | null>(null);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    let active = true;
    computeStorageBreakdown()
      .then((breakdown) => {
        if (active) setStorage(breakdown);
      })
      .catch(() => {
        if (active) setStorage(null);
      })
      .finally(() => {
        if (active) setStorageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const refreshStorage = () => {
    setStorageLoading(true);
    setReloadToken((token) => token + 1);
  };

  const requestCleanup = async (kind: CleanupKind) => {
    if (kind === 'cache') {
      await measureRecreatableCache().catch(() => 0);
      setCleanupKind('cache');
      return;
    }
    setCleanupKind('temp');
  };

  const runCleanup = async () => {
    const kind = cleanupKind;
    if (!kind) return;
    setCleaning(true);
    try {
      const result = kind === 'cache' ? await cleanRecreatableCache() : await cleanAbandonedFiles();
      if (kind === 'cache') {
        invalidatePreviewCaches();
      }
      if (result.freedBytes <= 0 && result.removedFiles <= 0 && result.removedDirectories <= 0) {
        showToast(t('settings.cleanupNothing'), 'info');
      } else {
        showToast(t('settings.cleanupDone', { size: formatBytes(result.freedBytes) }), 'success');
      }
      setReloadToken((token) => token + 1);
      await refreshLibrary();
    } catch {
      showToast(t('errors.STORAGE_DELETE_FAILED'), 'error');
    } finally {
      setCleaning(false);
      setCleanupKind(null);
    }
  };

  const storageRows: { label: string; bytes: number }[] = storage
    ? [
        { label: t('settings.storageProjects'), bytes: storage.projectsBytes },
        { label: t('settings.storagePacks'), bytes: storage.packsBytes },
        { label: t('settings.storageCache'), bytes: storage.cacheBytes },
        { label: t('settings.storageTemp'), bytes: storage.tempBytes },
        { label: t('settings.storageLibrary'), bytes: storage.libraryBytes },
      ]
    : [];

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <GroupLabel>{t('settings.storage')}</GroupLabel>
          <Button
            variant="ghost"
            size="sm"
            loading={storageLoading}
            onClick={refreshStorage}
            icon={<RefreshCw className="size-3.5" aria-hidden />}
          >
            {t('settings.storageRefresh')}
          </Button>
        </div>

        <SettingsCard>
          {storage ? (
            <>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <HardDrive className="size-4 text-accent" aria-hidden />
                  {t('settings.storageTotal')}
                </span>
                <span className="text-[15px] font-semibold tabular-nums text-ink">
                  {formatBytes(storage.totalBytes)}
                </span>
              </div>
              <details className="group border-t border-line/60">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[12px] font-medium text-ink-muted marker:content-none [&::-webkit-details-marker]:hidden"
                >
                  {t('settings.storageRefresh')}
                  <ChevronDown
                    className="size-4 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-line/40">
                  {storageRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-b border-line/40 px-4 py-2 last:border-b-0"
                    >
                      <span className="text-[12px] text-ink-soft">{row.label}</span>
                      <span className="text-[12px] font-medium tabular-nums text-ink">
                        {row.bytes > 0 ? formatBytes(row.bytes) : '0 B'}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p className="px-4 py-3 text-[13px] text-ink-muted">{t('settings.storageUnavailable')}</p>
          )}
        </SettingsCard>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => void requestCleanup('cache')}
            icon={<Trash2 className="size-3.5" aria-hidden />}
          >
            {t('settings.cleanupCacheAction')}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            fullWidth
            onClick={() => void requestCleanup('temp')}
            icon={<Trash2 className="size-3.5" aria-hidden />}
          >
            {t('settings.cleanupTempAction')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={cleanupKind !== null}
        title={cleanupKind === 'cache' ? t('settings.cleanupCacheTitle') : t('settings.cleanupTempTitle')}
        message={
          cleanupKind === 'cache'
            ? t('settings.cleanupCacheMessage', {
                size: storage ? formatBytes(storage.cacheBytes) : '0 B',
              })
            : t('settings.cleanupTempMessage')
        }
        confirmLabel={
          cleanupKind === 'cache' ? t('settings.cleanupCacheAction') : t('settings.cleanupTempAction')
        }
        cancelLabel={t('common.cancel')}
        loading={cleaning}
        onConfirm={() => void runCleanup()}
        onCancel={() => setCleanupKind(null)}
      />
    </>
  );
}
