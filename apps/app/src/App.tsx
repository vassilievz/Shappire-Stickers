import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { AppSplashScreen } from '@/app/AppSplashScreen';
import { EditorPage } from '@/features/editor/EditorPage';
import { HomePage } from '@/features/home/HomePage';
import { PackDetailPage } from '@/features/packs/PackDetailPage';
import { PacksPage } from '@/features/packs/PacksPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { MyPublicationsPage } from '@/features/community/MyPublicationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ToolsPage } from '@/features/tools/ToolsPage';
import { DonationsPage } from '@/features/donations/DonationsPage';
import { MonthlyDonorPage } from '@/features/monthly-donor/MonthlyDonorPage';
import { CommunityPage } from '@/features/community/CommunityPage';
import { AlbumDetailPage } from '@/features/community/AlbumDetailPage';
import { CreatorPublicPage } from '@/features/community/CreatorPublicPage';
import { useSocialPreferencesStore } from '@/state/socialPreferencesStore';
import { ToastHost } from '@/shared/components/overlays';
import { useSettingsStore } from '@/state/settingsStore';
import { useAuthStore } from '@/state/authStore';
import { notifyAppReadyIfNative } from '@/services/ota/otaService';
import { logAnalyticsEvent } from '@/services/firebase';
import { ShareAppPromoHost } from '@/features/promo/ShareAppPromoHost';
import { useAppUpdateStore } from '@/state/appUpdateStore';
import { ensureBodyScrollUnlocked } from '@/shared/utils/bodyScrollLock';

export function App() {
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const hydrateSocialPrefs = useSocialPreferencesStore((state) => state.hydrate);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = useAuthStore.getState().initialize();
    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    void hydrateSettings()
      .then(() => hydrateSocialPrefs())
      .finally(() => {
        setIsReady(true);
      });
  }, [hydrateSettings, hydrateSocialPrefs]);

  useEffect(() => {
    if (isReady) {
      void notifyAppReadyIfNative();
      void logAnalyticsEvent('app_open');
      void useAppUpdateStore.getState().bootstrap();
    }
  }, [isReady]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureBodyScrollUnlocked();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <HashRouter>
      <AppSplashScreen isReady={isReady} />
      <ShareAppPromoHost appReady={isReady} />
      <ToastHost />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pacotes" element={<PacksPage />} />
          <Route path="/pacotes/:packId" element={<PackDetailPage />} />
          <Route path="/comunidade" element={<CommunityPage />} />
          <Route path="/comunidade/album/:publicationId" element={<AlbumDetailPage />} />
          <Route path="/comunidade/criador/:username" element={<CreatorPublicPage />} />
          <Route path="/comunidade/minhas-publicacoes" element={<MyPublicationsPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/apoiar" element={<DonationsPage />} />
          <Route path="/doador-mensal" element={<MonthlyDonorPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:projectId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
