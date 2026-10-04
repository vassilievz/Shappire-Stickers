import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Info,
  Palette,
  RefreshCw,
  Shield,
  Sticker,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Divider, SectionTitle } from '@/shared/components/primitives';
import { SegmentedControl, SwitchField } from '@/shared/components/inputs';
import { ConfirmDialog } from '@/shared/components/overlays';
import { APP_INFO } from '@/config/app';
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
import { useSettingsStore } from '@/state/settingsStore';
import type { LanguagePreference, ThemePreference } from '@/services/storage/settingsRepository';
import { useTranslation } from '@/i18n';

const CREDITS: { name: string; license: string; url: string }[] = [
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Vite', license: 'MIT', url: 'https://vite.dev' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'Zustand', license: 'MIT', url: 'https://zustand.docs.pmnd.rs' },
  { name: 'Konva + React Konva', license: 'MIT', url: 'https://konvajs.org' },
  { name: 'Capacitor', license: 'MIT', url: 'https://capacitorjs.com' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'omggif', license: 'MIT', url: 'https://github.com/deanm/omggif' },
];

type CleanupKind = 'cache' | 'temp';

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const invalidatePreviewCaches = useLibraryStore((state) => state.invalidatePreviewCaches);
  const refreshLibrary = useLibraryStore((state) => state.refresh);

  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [cleanupKind, setCleanupKind] = useState<CleanupKind | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const themeOptions = [
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'system', label: t('settings.themeSystem') },
  ] as const;

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
  ] as const;

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

  const openRepository = () => {
    window.open(APP_INFO.repositoryUrl, '_blank', 'noopener,noreferrer');
  };

  const requestCleanup = async (kind: CleanupKind) => {
    if (kind === 'cache') {
      const size = await measureRecreatableCache().catch(() => 0);
      setCleanupKind('cache');
      return size;
    }
    setCleanupKind('temp');
    return 0;
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
    <div className="flex flex-col gap-8 pb-4 animate-fade-in">
      <header>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{t('settings.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {t('settings.subtitle')}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <SectionTitle title={t('settings.language')} />
        <SegmentedControl<LanguagePreference>
          label={t('settings.language')}
          value={settings.language}
          options={languageOptions}
          onChange={(language) => void update({ language })}
        />
      </section>

      <Divider />

      <section className="flex flex-col gap-4">
        <SectionTitle title={t('settings.appearance')} />
        <SegmentedControl<ThemePreference>
          label={t('settings.theme')}
          value={settings.theme}
          options={themeOptions}
          onChange={(theme) => void update({ theme })}
        />
        <SwitchField
          label={t('settings.transparencyGrid')}
          description={t('settings.transparencyGridDesc')}
          checked={settings.showTransparencyGrid}
          onChange={(showTransparencyGrid) => void update({ showTransparencyGrid })}
        />
      </section>

      <Divider />

      <section className="flex flex-col gap-4">
        <SectionTitle title={t('settings.editorAndPacks')} />
        <SwitchField
          label={t('settings.confirmDeletions')}
          description={t('settings.confirmDeletionsDesc')}
          checked={settings.confirmDestructiveActions}
          onChange={(confirmDestructiveActions) => void update({ confirmDestructiveActions })}
        />
        <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <p className="text-[13px] font-medium text-ink">{t('settings.whatsAppLimits')}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12px] leading-relaxed text-ink-muted">
            <li>{t('settings.limitSticker')}</li>
            <li>{t('settings.limitPack')}</li>
            <li>{t('settings.limitTray')}</li>
          </ul>
        </div>
        <SwitchField
          label={t('settings.diagnostics')}
          description={t('settings.diagnosticsDesc')}
          checked={settings.performanceDiagnostics}
          onChange={(performanceDiagnostics) => void update({ performanceDiagnostics })}
        />
      </section>

      <Divider />

      <section className="flex flex-col gap-3">
        <SectionTitle
          title={t('settings.storage')}
          description={t('settings.storageDesc')}
          action={
            <Button
              variant="ghost"
              size="sm"
              loading={storageLoading}
              onClick={refreshStorage}
              icon={<RefreshCw className="size-3.5" aria-hidden />}
            >
              {t('settings.storageRefresh')}
            </Button>
          }
        />
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface">
          {storage ? (
            <>
              {storageRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-line/60 px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="text-[13px] text-ink-soft">{row.label}</span>
                  <span className="text-[13px] font-medium tabular-nums text-ink">
                    {row.bytes > 0 ? formatBytes(row.bytes) : '—'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-surface-2/60 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <HardDrive className="size-4" aria-hidden />
                  {t('settings.storageTotal')}
                </span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">
                  {formatBytes(storage.totalBytes)}
                </span>
              </div>
            </>
          ) : (
            <p className="px-3.5 py-3 text-[13px] text-ink-muted">{t('settings.storageUnavailable')}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => void requestCleanup('cache')}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            {t('settings.cleanupCacheAction')}
          </Button>
          <Button
            variant="quiet"
            fullWidth
            onClick={() => void requestCleanup('temp')}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            {t('settings.cleanupTempAction')}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.privacy')} />
        <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <Shield className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <p className="text-[13px] leading-relaxed text-ink-soft">{t('settings.privacyDesc')}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.about')} />
        <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Sticker className="size-4" aria-hidden /> {t('settings.version')}
          </span>
          <Badge tone="neutral">{APP_INFO.version}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Info className="size-4" aria-hidden /> {t('settings.license')}
          </span>
          <span className="text-[13px] font-medium text-ink">{APP_INFO.licenseName}</span>
        </div>
        <Button
          variant="secondary"
          fullWidth
          onClick={openRepository}
          icon={<ExternalLink className="size-4" aria-hidden />}
        >
          {t('settings.viewSource')}
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.creditsAndLicenses')} />
        <ul className="flex flex-col gap-2">
          {CREDITS.map((lib) => (
            <li key={lib.name}>
              <a
                href={lib.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2 text-[13px] text-ink">
                  <CheckCircle2 className="size-3.5 text-ink-muted" aria-hidden />
                  {lib.name}
                </span>
                <span className="text-[12px] text-ink-muted">{lib.license}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
          <Palette className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('settings.whatsAppDisclaimer')}
        </p>
      </section>

      <footer className="mt-4 flex flex-col items-center justify-center border-t border-line/60 pt-6 pb-4 text-center">
        <p className="text-[13px] font-normal text-ink-muted">
          Made with ♡ in Brazil by{' '}
          <a
            href="https://www.instagram.com/vassilievz/"
            onClick={(e) => {
              e.preventDefault();
              window.open('https://www.instagram.com/vassilievz/', '_blank', 'noopener,noreferrer');
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink transition-colors hover:text-ink-soft active:opacity-75 underline underline-offset-4 decoration-line/80 hover:decoration-ink-soft"
          >
            vassiliev
          </a>
        </p>
      </footer>

      <ConfirmDialog
        open={cleanupKind !== null}
        title={
          cleanupKind === 'cache' ? t('settings.cleanupCacheTitle') : t('settings.cleanupTempTitle')
        }
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
    </div>
  );
}
