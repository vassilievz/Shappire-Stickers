import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { ToolsPage } from './ToolsPage';
import * as clipboardModule from '@/services/native/clipboard';
import * as toastStore from '@/state/toastStore';

vi.mock('@/services/tools/toolsApi', () => ({
  requestMediaDownload: vi.fn(),
  resolveToolsUrl: (url: string) => url,
  fetchImageAsDataUrl: vi.fn(),
  triggerBrowserDownload: vi.fn(),
  ToolsApiError: class ToolsApiError extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));

describe('ToolsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () =>
    render(
      <HashRouter>
        <ToolsPage />
      </HashRouter>,
    );

  it('renderiza o título, o campo de URL, o botão Colar e o botão do menu de plataformas', () => {
    renderComponent();

    expect(screen.getByText('Shappire Tools')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /colar|paste/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /plataformas suportadas|supported platforms/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('abre o menu de plataformas ao clicar no botão', async () => {
    const user = userEvent.setup();
    renderComponent();

    const menuBtn = screen.getAllByRole('button', {
      name: /plataformas suportadas|supported platforms/i,
    })[0];
    await user.click(menuBtn!);

    // O modal abre exibindo o campo de busca de plataformas
    expect(
      screen.getByPlaceholderText(/buscar entre mais de 1.700 plataformas|search 1,700\+ platforms/i),
    ).toBeInTheDocument();
  });

  it('insere a URL no campo ao clicar em Colar com sucesso', async () => {
    const user = userEvent.setup();
    vi.spyOn(clipboardModule, 'readClipboardText').mockResolvedValue({
      text: 'https://vm.tiktok.com/ZM12345/',
      success: true,
    });

    renderComponent();
    const pasteBtn = screen.getByRole('button', { name: /colar|paste/i });
    await user.click(pasteBtn);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('https://vm.tiktok.com/ZM12345/');
  });

  it('exibe toast de aviso caso a área de transferência esteja vazia', async () => {
    const user = userEvent.setup();
    const showToastSpy = vi.spyOn(toastStore, 'showToast');
    vi.spyOn(clipboardModule, 'readClipboardText').mockResolvedValue({
      text: '',
      success: false,
      error: 'empty',
    });

    renderComponent();
    const pasteBtn = screen.getByRole('button', { name: /colar|paste/i });
    await user.click(pasteBtn);

    expect(showToastSpy).toHaveBeenCalledWith(expect.any(String), 'warning');
  });

  it('permite selecionar uma plataforma no menu e digitar livremente qualquer URL', async () => {
    const user = userEvent.setup();
    renderComponent();

    const menuBtn = screen.getAllByRole('button', {
      name: /plataformas suportadas|supported platforms/i,
    })[0];
    await user.click(menuBtn!);

    // Busca por tiktok no modal
    const searchInput = screen.getByPlaceholderText(
      /buscar entre mais de 1.700 plataformas|search 1,700\+ platforms/i,
    );
    await user.type(searchInput, 'tiktok');

    // Clica em um item do menu
    const tiktokOptions = await screen.findAllByRole('button', { name: /tiktok/i });
    expect(tiktokOptions.length).toBeGreaterThan(0);
    await user.click(tiktokOptions[0]!);

    // O menu fecha e o input aceita digitação livre
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'https://instagram.com/p/123');
    expect(input.value).toBe('https://instagram.com/p/123');
  });
});
