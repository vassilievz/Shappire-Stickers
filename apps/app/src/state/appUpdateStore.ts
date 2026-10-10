import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { APP_INFO } from '@/config/app';
import { fetchAppRelease } from '@/services/api/appReleaseApi';
import { isVersionLessThan } from '@/services/app/semver';
import {
  applyOtaUpdate,
  checkOtaUpdate,
  downloadOtaUpdate,
  getOtaStatus,
  type UpdateCheckResult,
} from '@/services/ota/otaService';
import { fetchAvatarDecorationCatalog, peekAvatarDecorationCatalog } from '@/services/api/avatarDecorationApi';

const DISMISS_PREFIX = 'shappire:update-dismiss:';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type OtaUiState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'up_to_date';

export type StoreUpdateState = 'idle' | 'available' | 'required' | 'error';

interface AppUpdateState {
  lastCheckedAt: number | null;
  otaState: OtaUiState;
  otaVersion: string | null;
  otaError: string | null;
  storeState: StoreUpdateState;
  storeLatestVersion: string | null;
  storePlayUrl: string | null;
  storeReleaseNotes: string | null;
  dismissedKey: string | null;

  bootstrap: () => Promise<void>;
  checkForUpdates: (options?: { force?: boolean }) => Promise<void>;
  downloadOta: () => Promise<void>;
  applyOta: () => Promise<void>;
  dismissForVersion: (key: string) => void;
  openPlayStore: () => void;
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_PREFIX}${key}`) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${key}`, '1');
  } catch {
    /* ignore */
  }
}

function shouldSkipCheck(lastCheckedAt: number | null, force?: boolean): boolean {
  if (force) return false;
  if (!lastCheckedAt) return false;
  return Date.now() - lastCheckedAt < CHECK_INTERVAL_MS;
}

function applyOtaCheckResult(
  set: (partial: Partial<AppUpdateState>) => void,
  result: UpdateCheckResult,
): void {
  if (result.kind === 'update_available') {
    set({ otaState: 'available', otaVersion: result.version, otaError: null });
    return;
  }
  if (result.kind === 'already_staged') {
    set({ otaState: 'ready', otaVersion: result.version, otaError: null });
    return;
  }
  if (result.kind === 'error') {
    set({ otaState: 'error', otaError: result.message });
    return;
  }
  set({ otaState: 'up_to_date', otaError: null });
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  lastCheckedAt: null,
  otaState: 'idle',
  otaVersion: null,
  otaError: null,
  storeState: 'idle',
  storeLatestVersion: null,
  storePlayUrl: APP_INFO.playStoreUrl,
  storeReleaseNotes: null,
  dismissedKey: null,

  bootstrap: async () => {
    if (!peekAvatarDecorationCatalog()) {
      void fetchAvatarDecorationCatalog().catch(() => {});
    }

    const status = await getOtaStatus();
    if (status.hasStagedUpdate && status.stagedVersion) {
      set({ otaState: 'ready', otaVersion: status.stagedVersion });
    }
    await get().checkForUpdates();
  },

  checkForUpdates: async (options) => {
    if (shouldSkipCheck(get().lastCheckedAt, options?.force)) return;

    set({ lastCheckedAt: Date.now() });

    if (Capacitor.isNativePlatform()) {
      set({ otaState: get().otaState === 'ready' ? 'ready' : 'checking' });
      const otaResult = await checkOtaUpdate();
      applyOtaCheckResult(set, otaResult);
    }

    try {
      const release = await fetchAppRelease();
      const installed = APP_INFO.version;
      const { latestVersion, minVersion, playStoreUrl, releaseNotes } = release.android;
      const needsStore =
        isVersionLessThan(installed, latestVersion) || isVersionLessThan(installed, minVersion);
      const required = isVersionLessThan(installed, minVersion);
      set({
        storePlayUrl: playStoreUrl || APP_INFO.playStoreUrl,
        storeLatestVersion: latestVersion,
        storeReleaseNotes: releaseNotes ?? null,
        storeState: needsStore ? (required ? 'required' : 'available') : 'idle',
      });
    } catch {
      set({ storeState: 'error' });
    }
  },

  downloadOta: async () => {
    set({ otaState: 'downloading', otaError: null });
    const result = await downloadOtaUpdate();
    if (result.success) {
      set({
        otaState: 'ready',
        otaVersion: result.stagedVersion ?? get().otaVersion,
        otaError: null,
      });
      return;
    }
    set({ otaState: 'error', otaError: result.error });
  },

  applyOta: async () => {
    await applyOtaUpdate();
  },

  dismissForVersion: (key) => {
    writeDismissed(key);
    set({ dismissedKey: key });
  },

  openPlayStore: () => {
    const url = get().storePlayUrl ?? APP_INFO.playStoreUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  },
}));

export function isUpdateBannerDismissed(key: string): boolean {
  return readDismissed(key);
}
