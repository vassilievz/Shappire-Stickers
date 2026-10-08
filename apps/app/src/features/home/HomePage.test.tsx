import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { APP_INFO } from '@/config/app';

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
  it('renderiza o card da Comunidade Shappire com botão para o Discord', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <HashRouter>
        <HomePage />
      </HashRouter>,
    );

    expect(screen.getByText(/comunidade shappire|shappire community/i)).toBeInTheDocument();
    expect(screen.getByText('Discord Shappire')).toBeInTheDocument();

    const discordButton = screen.getByRole('button', {
      name: /entrar no discord|join discord/i,
    });
    expect(discordButton).toBeInTheDocument();

    await user.click(discordButton);
    expect(openSpy).toHaveBeenCalledWith(
      APP_INFO.discordCommunityUrl,
      '_blank',
      'noopener,noreferrer',
    );
  });
});
