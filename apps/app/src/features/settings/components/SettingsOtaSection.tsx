import { useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Badge, Button } from '@/shared/components/primitives';
import { APP_INFO } from '@/config/app';
import { useTranslation } from '@/i18n';
import { showToast } from '@/state/toastStore';
import { useAppUpdateStore } from '@/state/appUpdateStore';
import { GroupLabel, SettingsCard } from './SettingsLayout';

export function SettingsOtaSection() {
  const { t } = useTranslation();
  const otaState = useAppUpdateStore((s) => s.otaState);
  const otaVersion = useAppUpdateStore((s) => s.otaVersion);
  const otaError = useAppUpdateStore((s) => s.otaError);
  const deviceVersion = useAppUpdateStore((s) => s.deviceVersion);
  const syncDeviceVersion = useAppUpdateStore((s) => s.syncDeviceVersion);
  const checkForUpdates = useAppUpdateStore((s) => s.checkForUpdates);
  const downloadOta = useAppUpdateStore((s) => s.downloadOta);
  const applyOta = useAppUpdateStore((s) => s.applyOta);

  useEffect(() => {
    void syncDeviceVersion();
  }, [syncDeviceVersion]);

  const showStatusDetail =
    otaState === 'checking' ||
    otaState === 'downloading' ||
    otaState === 'available' ||
    otaState === 'ready' ||
    otaState === 'error';

  const handleCheck = async () => {
    const result = await checkForUpdates({ force: true });
    if (result === 'skipped') return;

    if (result.kind === 'up_to_date') {
      showToast(t('settings.upToDate'), 'success');
      return;
    }
    if (result.kind === 'update_available') {
      showToast(`${t('settings.updateAvailable')}: v${result.version}`, 'info');
      return;
    }
    if (result.kind === 'unsupported') {
      showToast(t('settings.browserEnvNotice'), 'info');
      return;
    }
    if (result.kind === 'error') {
      showToast(result.message, 'error');
    }
  };

  const handleDownload = async () => {
    const ok = await downloadOta();
    if (ok) {
      showToast(t('settings.updateReady'), 'success');
      return;
    }
    const err = useAppUpdateStore.getState().otaError;
    showToast(err ?? t('settings.downloadError'), 'error');
  };

  return (
    <section className="flex flex-col gap-2">
      <GroupLabel>{t('settings.updates')}</GroupLabel>
      <SettingsCard>
        <p className="border-b border-line/60 px-4 py-2.5 text-[12px] leading-relaxed text-ink-muted">
          {t('settings.updatesDesc')}
        </p>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] text-ink-soft">{t('settings.currentVersion')}</span>
          <Badge tone="neutral">v{deviceVersion ?? APP_INFO.version}</Badge>
        </div>

        {showStatusDetail ? (
          <p className="border-t border-line/60 px-4 py-2.5 text-[12px] leading-relaxed text-ink-muted">
            {otaState === 'checking' && t('settings.checkingUpdates')}
            {otaState === 'downloading' && t('settings.downloadingUpdate')}
            {otaState === 'available' && `${t('settings.updateAvailable')} (v${otaVersion ?? '?'})`}
            {otaState === 'ready' && t('settings.updateReadyDesc')}
            {otaState === 'error' && (otaError ?? t('settings.updateError'))}
          </p>
        ) : null}

        <div className="border-t border-line/60 p-3">
          {otaState === 'available' || otaState === 'downloading' ? (
            <Button
              variant="primary"
              fullWidth
              loading={otaState === 'downloading'}
              onClick={() => void handleDownload()}
              icon={<Download className="size-4" aria-hidden />}
            >
              {otaState === 'downloading' ? t('settings.downloadingUpdate') : t('settings.updateNow')}
            </Button>
          ) : otaState === 'ready' ? (
            <Button
              variant="primary"
              fullWidth
              onClick={() => void applyOta()}
              icon={<RefreshCw className="size-4" aria-hidden />}
            >
              {t('settings.restartNow')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              fullWidth
              loading={otaState === 'checking'}
              onClick={() => void handleCheck()}
              icon={<RefreshCw className="size-4" aria-hidden />}
            >
              {t('settings.checkForUpdates')}
            </Button>
          )}
        </div>
      </SettingsCard>
    </section>
  );
}
