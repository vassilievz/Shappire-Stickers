import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  HardDrive,
  Info,
  LogIn,
  LogOut,
  AtSign,
  Palette,
  RefreshCw,
  Shield,
  Sticker,
  Trash2,
  User,
} from 'lucide-react';
import { Badge, Button, Divider, SectionTitle } from '@/shared/components/primitives';
import { SegmentedControl, SwitchField, TextInput } from '@/shared/components/inputs';
import { BottomSheet, ConfirmDialog, Modal } from '@/shared/components/overlays';
import { cx } from '@/shared/utils/cx';
import { BlurFade } from '@/shared/components/motion';
import { hapticSelection } from '@/services/native/haptics';
import { APP_INFO } from '@/config/app';
import { INSTAGRAM_HANDLE, INSTAGRAM_LABEL, INSTAGRAM_PROFILE_URL } from '@/config/attribution';
import { openExternalLink } from '@/services/native/externalLinks';
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
import { useAuthStore } from '@/state/authStore';
import type { LanguagePreference, ThemePreference } from '@/services/storage/settingsRepository';
import { useTranslation } from '@/i18n';
import {
  applyOtaUpdate,
  checkOtaUpdate,
  downloadOtaUpdate,
  getOtaStatus,
  type AppUpdateStatus,
} from '@/services/ota/otaService';

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

  const [otaStatus, setOtaStatus] = useState<AppUpdateStatus | null>(null);
  const [otaCheckState, setOtaCheckState] = useState<
    'idle' | 'checking' | 'up_to_date' | 'update_available' | 'downloading' | 'ready' | 'error'
  >('idle');
  const [availableOtaVersion, setAvailableOtaVersion] = useState<string | null>(null);
  const [otaErrorMessage, setOtaErrorMessage] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signOut = useAuthStore((state) => state.signOut);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleGoogleSignIn = async () => {
    void hapticSelection();
    const ok = await signInWithGoogle();
    if (ok) {
      showToast('Login com o Google realizado com sucesso!', 'success');
    } else {
      const err = useAuthStore.getState().error;
      showToast(err || 'Não foi possível conectar com o Google.', 'error');
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      showToast('Sessão encerrada com sucesso.', 'info');
      setLogoutConfirmOpen(false);
    } catch {
      showToast('Não foi possível sair da conta.', 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    void getOtaStatus().then((status) => {
      setOtaStatus(status);
      if (status.hasStagedUpdate && status.stagedVersion) {
        setOtaCheckState('ready');
        setAvailableOtaVersion(status.stagedVersion);
      }
    });
  }, []);

  const handleCheckUpdates = async () => {
    setOtaCheckState('checking');
    setOtaErrorMessage(null);
    try {
      const result = await checkOtaUpdate();
      if (result.kind === 'up_to_date') {
        setOtaCheckState('up_to_date');
        showToast(t('settings.upToDate'), 'success');
      } else if (result.kind === 'update_available') {
        setOtaCheckState('update_available');
        setAvailableOtaVersion(result.version);
        showToast(`${t('settings.updateAvailable')}: v${result.version}`, 'info');
      } else if (result.kind === 'already_staged') {
        setOtaCheckState('ready');
        setAvailableOtaVersion(result.version);
      } else if (result.kind === 'unsupported') {
        setOtaCheckState('up_to_date');
        showToast(t('settings.browserEnvNotice'), 'info');
      } else if (result.kind === 'error') {
        setOtaCheckState('error');
        setOtaErrorMessage(result.message);
        showToast(result.message, 'error');
      }
    } catch (error) {
      setOtaCheckState('error');
      const msg = error instanceof Error ? error.message : t('settings.updateError');
      setOtaErrorMessage(msg);
      showToast(msg, 'error');
    }
  };

  const handleDownloadUpdate = async () => {
    setOtaCheckState('downloading');
    setOtaErrorMessage(null);
    try {
      const result = await downloadOtaUpdate();
      if (result.success) {
        setOtaCheckState('ready');
        if (result.stagedVersion) {
          setAvailableOtaVersion(result.stagedVersion);
        }
        showToast(t('settings.updateReady'), 'success');
      } else {
        setOtaCheckState('error');
        setOtaErrorMessage(result.error ?? t('settings.downloadError'));
        showToast(result.error ?? t('settings.downloadError'), 'error');
      }
    } catch (error) {
      setOtaCheckState('error');
      const msg = error instanceof Error ? error.message : t('settings.downloadError');
      setOtaErrorMessage(msg);
      showToast(msg, 'error');
    }
  };

  const handleRestart = async () => {
    await applyOtaUpdate();
  };

  const themeOptions = [
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'system', label: t('settings.themeSystem') },
  ] as const;

  const LANGUAGE_LIST: { value: LanguagePreference; flag: string; label: string }[] = [
    { value: 'pt-BR', flag: '🇧🇷', label: 'Português (Brasil)' },
    { value: 'en', flag: '🇺🇸', label: 'English' },
    { value: 'es', flag: '🇪🇸', label: 'Español' },
    { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { value: 'it', flag: '🇮🇹', label: 'Italiano' },
    { value: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  ];

  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const currentLang = LANGUAGE_LIST.find((item) => item.value === settings.language) ?? LANGUAGE_LIST[0]!;

  const handleSelectLanguage = (lang: LanguagePreference) => {
    void hapticSelection();
    void update({ language: lang });
    setLangSheetOpen(false);
  };

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

      <BlurFade durationMs={300} delayMs={0}>
        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Conta"
            description="Sincronize seu perfil. O aplicativo continua 100% funcional offline sem conta."
            action={isAuthenticated ? <Badge tone="neutral">Conectado</Badge> : undefined}
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              {isAuthenticated && user ? (
                user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="size-10 shrink-0 rounded-full border border-line object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-[14px] font-semibold text-ink"
                    aria-hidden
                  >
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )
              ) : (
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-muted"
                  aria-hidden
                >
                  <User className="size-5" />
                </span>
              )}
              <div className="flex flex-col min-w-0">
                <span className="truncate text-[14px] font-medium text-ink">
                  {isAuthenticated && user
                    ? profile?.displayName || user.displayName || 'Usuário Shappire'
                    : 'Não conectado'}
                </span>
                <span className="truncate text-[12px] text-ink-muted">
                  {isAuthenticated && user
                    ? user.email || 'Sem e-mail'
                    : 'Entrar permite associar seus dados de perfil'}
                </span>
              </div>
            </div>

            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoutConfirmOpen(true)}
                icon={<LogOut className="size-3.5" aria-hidden />}
              >
                Sair
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={isSigningIn}
                onClick={() => void handleGoogleSignIn()}
                icon={<LogIn className="size-3.5" aria-hidden />}
              >
                Entrar com Google
              </Button>
            )}
          </div>
        </section>
      </BlurFade>

      <Divider />

      <BlurFade durationMs={300} delayMs={50}>
      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.language')} />
        <button
          type="button"
          onClick={() => setLangSheetOpen(true)}
          className="flex h-13 w-full items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface px-4 text-left transition-colors hover:border-focus/40 hover:bg-surface-2 active:bg-surface-3 cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[22px] leading-none select-none shrink-0" aria-hidden>
              {currentLang.flag}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[14px] font-medium text-ink">
                {currentLang.label}
              </span>
              <span className="text-[11px] text-ink-muted">
                {t('settings.language')}
              </span>
            </div>
          </div>
          <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
        </button>
      </section>
      </BlurFade>

      <Divider />

      <BlurFade durationMs={300} delayMs={70}>
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
      </BlurFade>

      <Divider />

      <BlurFade durationMs={300} delayMs={140}>
      <section className="flex flex-col gap-4">
        <SectionTitle
          title={t('settings.attribution')}
          description={t('settings.attributionDesc')}
        />
        <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
          <TextInput
            label={t('settings.authorName')}
            name="settings-author-display-name"
            value={settings.authorDisplayName}
            maxLength={24}
            placeholder="Vassiliev"
            onChange={(e) => void update({ authorDisplayName: e.target.value.slice(0, 24) })}
            hint={t('settings.authorNameHint')}
          />
          <p className="mt-3 flex items-center justify-center gap-x-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-center text-[12px] text-ink-soft">
            <span className="font-medium text-ink">{settings.authorDisplayName.trim() || 'Vassiliev'}</span>
            <span aria-hidden className="text-ink-muted">·</span>
            <span className="text-ink-muted">{INSTAGRAM_LABEL}</span>
            <span aria-hidden className="text-ink-muted">·</span>
            <span className="font-medium text-ink">{INSTAGRAM_HANDLE}</span>
          </p>
        </div>
      </section>
      </BlurFade>

      <Divider />

      <BlurFade durationMs={300} delayMs={210}>
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
      </BlurFade>

      <Divider />

      <BlurFade durationMs={300} delayMs={280}>
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
      </BlurFade>

      <BlurFade durationMs={300} delayMs={340}>
      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.privacy')} />
        <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <Shield className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <p className="text-[13px] leading-relaxed text-ink-soft">{t('settings.privacyDesc')}</p>
        </div>
      </section>
      </BlurFade>

      <BlurFade durationMs={300} delayMs={330}>
      <section className="flex flex-col gap-3">
        <SectionTitle
          title={t('settings.updates')}
          description={t('settings.updatesDesc')}
        />
        <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Download className="size-4 text-ink-muted" aria-hidden />
              {t('settings.currentVersion')}
            </span>
            <Badge tone="neutral">
              v{otaStatus?.currentVersion || APP_INFO.version}
            </Badge>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-line/60">
            <span className="text-[13px] text-ink-soft">
              {t('settings.updateStatus')}
            </span>
            <span className="text-[12px] font-medium text-ink-muted">
              {otaCheckState === 'checking' && t('settings.checkingUpdates')}
              {otaCheckState === 'downloading' && t('settings.downloadingUpdate')}
              {otaCheckState === 'update_available' && `${t('settings.updateAvailable')} (v${availableOtaVersion})`}
              {otaCheckState === 'ready' && t('settings.updateReady')}
              {(otaCheckState === 'idle' || otaCheckState === 'up_to_date') && t('settings.upToDate')}
              {otaCheckState === 'error' && (otaErrorMessage || t('settings.updateError'))}
            </span>
          </div>

          {otaCheckState === 'ready' && (
            <div className="mt-1 rounded-[10px] bg-surface-2 p-2.5 text-[12px] leading-relaxed text-ink-muted">
              {t('settings.updateReadyDesc')}
            </div>
          )}

          <div className="pt-2">
            {otaCheckState === 'update_available' || otaCheckState === 'downloading' ? (
              <Button
                variant="primary"
                fullWidth
                loading={otaCheckState === 'downloading'}
                onClick={() => void handleDownloadUpdate()}
                icon={<Download className="size-4" aria-hidden />}
              >
                {otaCheckState === 'downloading' ? t('settings.downloadingUpdate') : t('settings.updateNow')}
              </Button>
            ) : otaCheckState === 'ready' ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => void handleRestart()}
                icon={<RefreshCw className="size-4" aria-hidden />}
              >
                {t('settings.restartNow')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                fullWidth
                loading={otaCheckState === 'checking'}
                onClick={() => void handleCheckUpdates()}
                icon={<RefreshCw className="size-4" aria-hidden />}
              >
                {t('settings.checkForUpdates')}
              </Button>
            )}
          </div>
        </div>
      </section>
      </BlurFade>

      <BlurFade durationMs={300} delayMs={350}>
      <section className="flex flex-col gap-3">
        <SectionTitle title={t('settings.about')} />
        <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Sticker className="size-4" aria-hidden /> {t('settings.version')}
          </span>
          <Badge tone="neutral">v{otaStatus?.currentVersion || APP_INFO.version}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Info className="size-4" aria-hidden /> {t('settings.license')}
          </span>
          <span className="text-[13px] font-medium text-ink">{APP_INFO.licenseName}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="quiet"
            fullWidth
            onClick={() => setLicensesOpen(true)}
            icon={<CheckCircle2 className="size-4" aria-hidden />}
          >
            Licenças de código aberto
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={openRepository}
            icon={<ExternalLink className="size-4" aria-hidden />}
          >
            {t('settings.viewSource')}
          </Button>
        </div>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted pt-1">
          <Palette className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('settings.whatsAppDisclaimer')}
        </p>
      </section>
      </BlurFade>

      <footer className="mt-6 flex flex-col items-center justify-center border-t border-line/40 pt-7 pb-2 text-center select-none">
        <span
          aria-hidden
          className="mb-3 flex size-11 items-center justify-center rounded-full border border-line bg-surface"
        >
          <Sticker className="size-5 text-ink-muted" />
        </span>
        <p className="text-[13px] font-semibold tracking-[0.08em] text-ink">
          Shappire Stickers
        </p>
        <p className="mt-1 text-[11.5px] text-ink-muted">
          Developed by <span className="text-ink-soft">Vassiliev</span>
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

      <Modal
        open={licensesOpen}
        title="Licenças de Código Aberto"
        description="Agradecimento aos projetos de software livre utilizados no Shappire Stickers."
        onClose={() => setLicensesOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setLicensesOpen(false)}>
            {t('common.close') || 'Fechar'}
          </Button>
        }
      >
        <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-1">
          {CREDITS.map((lib) => (
            <li key={lib.name}>
              <a
                href={lib.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-2.5 transition-colors hover:bg-surface-3"
              >
                <span className="text-[13px] font-medium text-ink">{lib.name}</span>
                <span className="text-[12px] font-mono text-ink-muted">{lib.license}</span>
              </a>
            </li>
          ))}
        </ul>
      </Modal>

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

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sair da conta?"
        message="Seus pacotes e figurinhas criados localmente continuarão disponíveis normalmente no aparelho."
        confirmLabel="Sair"
        cancelLabel={t('common.cancel') || 'Cancelar'}
        loading={loggingOut}
        onConfirm={() => void handleSignOut()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <BottomSheet
        open={langSheetOpen}
        title={t('settings.languageSelect')}
        onClose={() => setLangSheetOpen(false)}
      >
        <div className="flex flex-col gap-1.5 pb-2">
          {LANGUAGE_LIST.map((item) => {
            const isSelected = item.value === settings.language;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSelectLanguage(item.value)}
                className={cx(
                  'flex w-full items-center justify-between rounded-[var(--radius-control)] px-3.5 py-3 text-left transition-all',
                  isSelected
                    ? 'bg-surface-3 text-ink ring-1 ring-white/15'
                    : 'text-ink-soft hover:bg-surface-2 hover:text-ink active:bg-surface-3',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[24px] leading-none select-none shrink-0" aria-hidden>
                    {item.flag}
                  </span>
                  <span className="truncate text-[14px] font-medium text-ink">
                    {item.label}
                  </span>
                </div>
                <div
                  className={cx(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isSelected
                      ? 'border-focus bg-accent text-on-accent'
                      : 'border-line bg-surface-2',
                  )}
                >
                  {isSelected ? <Check className="size-3 stroke-[3]" aria-hidden /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
