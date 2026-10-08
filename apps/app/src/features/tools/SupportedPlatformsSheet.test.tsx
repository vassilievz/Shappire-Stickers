import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportedPlatformsSheet } from './SupportedPlatformsSheet';

describe('SupportedPlatformsSheet', () => {
  it('não renderiza nada se open=false', () => {
    const { container } = render(
      <SupportedPlatformsSheet
        open={false}
        onClose={vi.fn()}
        selectedPlatform={null}
        onSelectPlatform={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renderiza o modal quando open=true com contador e campo de busca', () => {
    render(
      <SupportedPlatformsSheet
        open={true}
        onClose={vi.fn()}
        selectedPlatform={null}
        onSelectPlatform={vi.fn()}
      />,
    );

    expect(screen.getByText(/1731|1\.731/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/buscar entre mais de 1.700 plataformas|search 1,700\+ platforms/i),
    ).toBeInTheDocument();
  });

  it('filtra plataformas em tempo real ao digitar na busca', async () => {
    const user = userEvent.setup();
    render(
      <SupportedPlatformsSheet
        open={true}
        onClose={vi.fn()}
        selectedPlatform={null}
        onSelectPlatform={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /buscar entre mais de 1.700 plataformas|search 1,700\+ platforms/i,
    );
    await user.type(searchInput, 'instagram');

    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('instagram:story')).toBeInTheDocument();
  });

  it('chama onSelectPlatform e onClose ao clicar em uma plataforma', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <SupportedPlatformsSheet
        open={true}
        onClose={handleClose}
        selectedPlatform={null}
        onSelectPlatform={handleSelect}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /buscar entre mais de 1.700 plataformas|search 1,700\+ platforms/i,
    );
    await user.type(searchInput, 'youtube');

    const youtubeButtons = screen.getAllByRole('button', { name: /youtube/i });
    expect(youtubeButtons.length).toBeGreaterThan(0);
    await user.click(youtubeButtons[0]!);

    expect(handleSelect).toHaveBeenCalledWith(expect.stringMatching(/youtube/i));
    expect(handleClose).toHaveBeenCalled();
  });
});
