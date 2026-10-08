import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { AppSplashScreen } from '@/app/AppSplashScreen';
import { EditorPage } from '@/features/editor/EditorPage';
import { HomePage } from '@/features/home/HomePage';
import { PackDetailPage } from '@/features/packs/PackDetailPage';
import { PacksPage } from '@/features/packs/PacksPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ToastHost } from '@/shared/components/overlays';
import { useSettingsStore } from '@/state/settingsStore';
import { useAuthStore } from '@/state/authStore';
import { notifyAppReadyIfNative } from '@/services/ota/otaService';
import { logAnalyticsEvent } from '@/services/firebase';

export function App() {
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = useAuthStore.getState().initialize();
    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    void hydrateSettings().finally(() => {
      setIsReady(true);
    });
  }, [hydrateSettings]);

  useEffect(() => {
    if (isReady) {
      void notifyAppReadyIfNative();
      void logAnalyticsEvent('app_open');
    }
  }, [isReady]);

  return (
    <HashRouter>
      <AppSplashScreen isReady={isReady} />
      <ToastHost />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pacotes" element={<PacksPage />} />
          <Route path="/pacotes/:packId" element={<PackDetailPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:projectId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
