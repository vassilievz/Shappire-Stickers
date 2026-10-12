import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SegmentedControl, SwitchField, TextInput } from '@/shared/components/inputs';
import { BottomSheet } from '@/shared/components/overlays';
import { cx } from '@/shared/utils/cx';
import { hapticSelection } from '@/services/native/haptics';
import { useSettingsStore } from '@/state/settingsStore';
import type { LanguagePreference, ThemePreference } from '@/services/storage/settingsRepository';
import { useTranslation } from '@/i18n';
import { GroupLabel, SettingsCard } from './components/SettingsLayout';
import { SettingsOtaSection } from './components/SettingsOtaSection';
import { SettingsStorageSection } from './components/SettingsStorageSection';
import { SettingsAboutSection } from './components/SettingsAboutSection';
import { SettingsFooter } from './components/SettingsFooter';

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const [langSheetOpen, setLangSheetOpen] = useState(false);

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

  const currentLang = LANGUAGE_LIST.find((item) => item.value === settings.language) ?? LANGUAGE_LIST[0]!;

  const handleSelectLanguage = (lang: LanguagePreference) => {
    void hapticSelection();
    void update({ language: lang });
    setLangSheetOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t('settings.title')}</h1>
        <p className="text-sm text-ink-muted">{t('settings.subtitle')}</p>
      </header>

      <section className="flex flex-col gap-2">
        <GroupLabel>{t('settings.appearance')}</GroupLabel>
        <SettingsCard>
          <button
            type="button"
            onClick={() => setLangSheetOpen(true)}
            className="flex w-full items-center justify-between border-b border-line/60 px-4 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-3 cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[20px] leading-none select-none shrink-0" aria-hidden>
                {currentLang.flag}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[13.5px] font-medium text-ink">{t('settings.language')}</span>
                <span className="text-[11.5px] text-ink-muted">{currentLang.label}</span>
              </div>
            </div>
            <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </button>

          <div className="border-b border-line/60 px-4 py-3">
            <SegmentedControl<ThemePreference>
              label={t('settings.theme')}
              value={settings.theme}
              options={themeOptions}
              onChange={(theme) => void update({ theme })}
            />
          </div>

          <div className="px-4 py-2">
            <SwitchField
              label={t('settings.transparencyGrid')}
              description={t('settings.transparencyGridDesc')}
              checked={settings.showTransparencyGrid}
              onChange={(showTransparencyGrid) => void update({ showTransparencyGrid })}
            />
          </div>
        </SettingsCard>
      </section>

      <section className="flex flex-col gap-2">
        <GroupLabel>{t('settings.editorAndPacks')}</GroupLabel>
        <SettingsCard>
          <div className="border-b border-line/60 px-4 py-2">
            <SwitchField
              label={t('settings.confirmDeletions')}
              description={t('settings.confirmDeletionsDesc')}
              checked={settings.confirmDestructiveActions}
              onChange={(confirmDestructiveActions) => void update({ confirmDestructiveActions })}
            />
          </div>

          <div className="border-b border-line/60 px-4 py-2">
            <SwitchField
              label={t('settings.diagnostics')}
              description={t('settings.diagnosticsDesc')}
              checked={settings.performanceDiagnostics}
              onChange={(performanceDiagnostics) => void update({ performanceDiagnostics })}
            />
          </div>

          <details className="group border-t border-line/60">
            <summary
              className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium text-ink-soft marker:content-none [&::-webkit-details-marker]:hidden"
            >
              {t('settings.whatsAppLimits')}
              <ChevronDown
                className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <ul className="space-y-1 px-4 pb-3 text-[12px] leading-relaxed text-ink-muted">
              <li>{t('settings.limitSticker')}</li>
              <li>{t('settings.limitPack')}</li>
              <li>{t('settings.limitTray')}</li>
              <li className="pt-2 border-t border-line/50 text-[11.5px]">{t('settings.whatsAppDisclaimer')}</li>
            </ul>
          </details>
        </SettingsCard>
      </section>

      <section className="flex flex-col gap-2">
        <GroupLabel>{t('settings.attribution')}</GroupLabel>
        <SettingsCard className="p-4">
          <TextInput
            label={t('settings.authorName')}
            name="settings-author-display-name"
            value={settings.authorDisplayName}
            maxLength={24}
            placeholder="Vassiliev"
            onChange={(e) => void update({ authorDisplayName: e.target.value.slice(0, 24) })}
            hint={t('settings.authorNameHint')}
          />
        </SettingsCard>
      </section>

      <SettingsStorageSection />
      <SettingsOtaSection />
      <SettingsAboutSection />
      <SettingsFooter />

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
                  <span className="truncate text-[14px] font-medium text-ink">{item.label}</span>
                </div>
                <div
                  className={cx(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isSelected ? 'border-focus bg-accent text-on-accent' : 'border-line bg-surface-2',
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
