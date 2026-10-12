import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

vi.mock('@/state/libraryStore', () => ({
  useLibraryStore: vi.fn((selector) =>
    selector({
      projects: [],
      hiddenProjects: [],
      packs: [],
      packPreviews: {},
      refresh: vi.fn(),
      hideProject: vi.fn(),
      restoreProject: vi.fn(),
      removeProject: vi.fn(),
    }),
  ),
}));

describe('HomePage', () => {
  it('renderiza ações principais de criação e pacotes', () => {
    render(
      <HashRouter>
        <HomePage />
      </HashRouter>,
    );

    expect(screen.getByRole('button', { name: /criar figurinha|create sticker/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /novo pacote|new pack/i }).length).toBeGreaterThan(0);
  });
});
