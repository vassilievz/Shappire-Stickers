import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import {
  applyOtaUpdate,
  checkOtaUpdate,
  downloadOtaUpdate,
  getOtaStatus,
  type UpdateCheckResult,
} from '@/services/ota/otaService';

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

interface AppUpdateState {
  lastCheckedAt: number | null;
  otaState: OtaUiState;
  otaVersion: string | null;
  otaError: string | null;
  dismissedKey: string | null;
  deviceVersion: string | null;

  bootstrap: () => Promise<void>;
  syncDeviceVersion: () => Promise<void>;
  checkForUpdates: (options?: { force?: boolean }) => Promise<UpdateCheckResult | 'skipped'>;
  downloadOta: () => Promise<boolean>;
  applyOta: () => Promise<void>;
  dismissForVersion: (key: string) => void;
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
  if (result.kind === 'up_to_date' || result.kind === 'unsupported') {
    set({ otaState: 'up_to_date', otaError: null });
  }
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  lastCheckedAt: null,
  otaState: 'idle',
  otaVersion: null,
  otaError: null,
  dismissedKey: null,
  deviceVersion: null,

  syncDeviceVersion: async () => {
    const status = await getOtaStatus();
    set({ deviceVersion: status.currentVersion });
    if (status.hasStagedUpdate && status.stagedVersion) {
      set({ otaState: 'ready', otaVersion: status.stagedVersion });
    }
  },

  bootstrap: async () => {
    await get().syncDeviceVersion();
    await get().checkForUpdates();
  },

  checkForUpdates: async (options) => {
    if (shouldSkipCheck(get().lastCheckedAt, options?.force)) {
      return 'skipped';
    }

    set({ lastCheckedAt: Date.now() });

    if (!Capacitor.isNativePlatform()) {
      set({ otaState: 'up_to_date' });
      return { kind: 'unsupported' };
    }

    set({ otaState: get().otaState === 'ready' ? 'ready' : 'checking' });
    const otaResult = await checkOtaUpdate();
    applyOtaCheckResult(set, otaResult);
    await get().syncDeviceVersion();
    return otaResult;
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
      await get().syncDeviceVersion();
      return true;
    }
    set({ otaState: 'error', otaError: result.error });
    return false;
  },

  applyOta: async () => {
    await applyOtaUpdate();
  },

  dismissForVersion: (key) => {
    writeDismissed(key);
    set({ dismissedKey: key });
  },
}));

export function isUpdateBannerDismissed(key: string): boolean {
  return readDismissed(key);
}
