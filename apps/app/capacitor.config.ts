import type { CapacitorConfig } from '@capacitor/cli';

/** Deve coincidir com `src/config/ota.ts` (OtaKit console). */
const OTAKIT_APP_ID = 'c4cf6be0-def9-480d-936e-0be638499ca3';
/** Alinhar com `package.json` / `APP_INFO.version` — baked no APK nativo. */
const OTAKIT_RUNTIME_VERSION = '0.3.0';

/**
 * Configuração do Capacitor.
 *
 * - `appId`: define o `applicationId` do Android e também a authority do
 *   ContentProvider de figurinhas (`<appId>.stickercontentprovider`).
 * - `webDir`: pasta gerada pelo Vite que é copiada para dentro do APK.
 * - Sem servidor remoto: o app funciona 100% offline (arquivos locais).
 */
const config: CapacitorConfig = {
  appId: 'com.shappire.stickers',
  appName: 'Shappire Stickers',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#08090b',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#08090b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08090b',
      overlaysWebView: false,
    },
    OtaKit: {
      appId: OTAKIT_APP_ID,
      runtimeVersion: OTAKIT_RUNTIME_VERSION,
    },
  },
};

export default config;
