import { create } from 'zustand';
import type { SocialPreferences } from '@shappire/contracts';
import {
  confirmAdultEligibility,
  fetchSocialPreferences,
  updateSocialPreferences,
} from '@/services/api/socialApi';
import { useAuthStore } from './authStore';

interface SocialPreferencesState {
  preferences: SocialPreferences;
  status: 'idle' | 'loading' | 'ready' | 'error';
  hydrate: () => Promise<void>;
  setShowAdultContent: (value: boolean) => Promise<void>;
  acknowledgeAdultGate: () => Promise<void>;
  invalidate: () => void;
}

const DEFAULT: SocialPreferences = {
  showAdultContent: false,
  adultContentEligible: false,
};

export const useSocialPreferencesStore = create<SocialPreferencesState>((set, get) => ({
  preferences: { ...DEFAULT },
  status: 'idle',

  hydrate: async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      set({ preferences: { ...DEFAULT }, status: 'ready' });
      return;
    }
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const preferences = await fetchSocialPreferences();
      set({ preferences, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },

  setShowAdultContent: async (value) => {
    const updated = await updateSocialPreferences({ showAdultContent: value });
    set({ preferences: updated });
  },

  acknowledgeAdultGate: async () => {
    const updated = await confirmAdultEligibility();
    set({ preferences: updated });
  },

  invalidate: () => set({ status: 'idle' }),
}));
