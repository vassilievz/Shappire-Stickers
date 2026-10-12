import { Capacitor } from '@capacitor/core';
import {
  OtaKit,
  type BundleInfo,
  type CheckResult,
  type DownloadResult,
  type OtaKitState,
} from '@otakit/capacitor-updater';
import { APP_INFO } from '@/config/app';
import { OTAKIT_APP_ID } from '@/config/ota';

let hasNotifiedReady = false;

export interface AppUpdateStatus {
  isNative: boolean;
  currentVersion: string;
  bundleStatus?: string;
  stagedVersion: string | null;
  hasStagedUpdate: boolean;
  lastFailure: BundleInfo | null;
}

export type UpdateCheckResult =
  | { kind: 'unsupported' }
  | { kind: 'up_to_date' }
  | { kind: 'already_staged'; version: string }
  | { kind: 'update_available'; version: string; size: number }
  | { kind: 'error'; message: string };

export type UpdateDownloadResult =
  | { success: true; stagedVersion: string }
  | { success: false; error: string };

export async function notifyAppReadyIfNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || hasNotifiedReady) {
    return false;
  }

  try {
    await OtaKit.notifyAppReady();
    hasNotifiedReady = true;
    return true;
  } catch (error) {
    console.warn('[OtaKit] notifyAppReady falhou:', error);
    return false;
  }
}

export async function getOtaStatus(): Promise<AppUpdateStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      isNative: false,
      currentVersion: APP_INFO.version,
      stagedVersion: null,
      hasStagedUpdate: false,
      lastFailure: null,
    };
  }

  try {
    const state: OtaKitState = await OtaKit.getState();
    const lastFailure = await OtaKit.getLastFailure().catch(() => null);

    const currentVersion = state.current?.version?.trim() || APP_INFO.version;
    const stagedVersion = state.staged?.version?.trim() || null;

    return {
      isNative: true,
      currentVersion,
      bundleStatus: state.current?.status,
      stagedVersion,
      hasStagedUpdate: stagedVersion !== null,
      lastFailure,
    };
  } catch (error) {
    console.warn('[OtaKit] getState falhou:', error);
    return {
      isNative: true,
      currentVersion: APP_INFO.version,
      stagedVersion: null,
      hasStagedUpdate: false,
      lastFailure: null,
    };
  }
}

export async function checkOtaUpdate(): Promise<UpdateCheckResult> {
  if (!Capacitor.isNativePlatform()) {
    return { kind: 'unsupported' };
  }

  try {
    const result: CheckResult = await OtaKit.check();
    console.info('[OtaKit] check', {
      appId: OTAKIT_APP_ID,
      runtimeVersion: APP_INFO.version,
      kind: result.kind,
    });

    if (result.kind === 'no_update') {
      return { kind: 'up_to_date' };
    }
    if (result.kind === 'already_staged') {
      return { kind: 'already_staged', version: result.latest.version };
    }
    if (result.kind === 'update_available') {
      return {
        kind: 'update_available',
        version: result.latest.version,
        size: result.latest.size,
      };
    }
    return { kind: 'up_to_date' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao verificar atualizações';
    console.warn('[OtaKit] check falhou:', error);
    return { kind: 'error', message };
  }
}

export async function downloadOtaUpdate(): Promise<UpdateDownloadResult> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Atualizações OTA indisponíveis no navegador.' };
  }

  try {
    const res: DownloadResult = await OtaKit.download();
    if (res.kind === 'staged') {
      return { success: true, stagedVersion: res.bundle.version };
    }
    return { success: false, error: 'Nenhuma atualização pronta para download.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao baixar atualização.';
    console.warn('[OtaKit] download falhou:', error);
    return { success: false, error: message };
  }
}

export async function applyOtaUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.location.reload();
    return;
  }

  try {
    await OtaKit.apply();
  } catch (error) {
    console.error('[OtaKit] apply falhou:', error);
    window.location.reload();
  }
}
