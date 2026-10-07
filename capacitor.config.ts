import type { CapacitorConfig } from '@capacitor/cli';

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
      appId: 'c4cf6be0-def9-480d-936e-0be638499ca3',
    },
  },
};

export default config;
