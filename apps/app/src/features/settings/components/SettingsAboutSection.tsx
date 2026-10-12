import { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { Modal } from '@/shared/components/overlays';
import { APP_INFO } from '@/config/app';
import { useTranslation } from '@/i18n';
import { GroupLabel, SettingsCard, SettingsNavRow } from './SettingsLayout';
import { SETTINGS_CREDITS } from './settingsCredits';

export function SettingsAboutSection() {
  const { t } = useTranslation();
  const [licensesOpen, setLicensesOpen] = useState(false);

  const openRepository = () => {
    window.open(APP_INFO.repositoryUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <section className="flex flex-col gap-2">
        <GroupLabel>{t('settings.about')}</GroupLabel>
        <SettingsCard>
          <p className="border-b border-line/60 px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
            {t('settings.privacyDesc')}
          </p>
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
            <span className="text-[13px] text-ink-soft">{t('settings.license')}</span>
            <span className="text-[13px] font-medium text-ink">{APP_INFO.licenseName}</span>
          </div>
          <SettingsNavRow
            label={t('settings.openSourceLicenses')}
            onClick={() => setLicensesOpen(true)}
            leading={<Info className="size-4 text-accent" aria-hidden />}
          />
          <SettingsNavRow
            label={t('settings.viewSource')}
            value="GitHub"
            onClick={openRepository}
            leading={<ExternalLink className="size-4 text-accent" aria-hidden />}
          />
        </SettingsCard>
      </section>

      <Modal
        open={licensesOpen}
        title={t('settings.licensesTitle')}
        description={t('settings.licensesDesc')}
        onClose={() => setLicensesOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setLicensesOpen(false)}>
            {t('common.close')}
          </Button>
        }
      >
        <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-1">
          {SETTINGS_CREDITS.map((lib) => (
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
    </>
  );
}
