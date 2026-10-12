import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { DEFAULT_SETTINGS } from '@/services/storage/settingsRepository';

vi.mock('@/state/settingsStore', () => ({
  useSettingsStore: (selector: (s: {
    hydrate: () => Promise<void>;
    settings: typeof DEFAULT_SETTINGS;
    update: () => void;
  }) => unknown) =>
    selector({
      hydrate: vi.fn(async () => undefined),
      settings: DEFAULT_SETTINGS,
      update: vi.fn(),
    }),
}));

describe('App bootstrap', () => {
  it('não inicializa autenticação nem API remota', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText(/entrar com google|sign in with google/i)).not.toBeInTheDocument();
    });
  });
});
