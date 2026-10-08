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

  it('renderiza o título, o campo de URL, o botão Colar e as plataformas', () => {
    renderComponent();

    expect(screen.getByText('Shappire Tools')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /colar|paste/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tiktok$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^instagram$/i })).toBeInTheDocument();
  });

  it('não exibe YouTube na lista de plataformas suportadas', () => {
    renderComponent();
    expect(screen.queryByText(/^youtube$/i)).toBeNull();
    expect(screen.queryByText(/youtube/i)).toBeNull();
  });

  it('possui o container de plataformas com scroll-fade-x e no-scrollbar', () => {
    const { container } = renderComponent();
    const scrollContainer = container.querySelector('.scroll-fade-x');

    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.classList.contains('no-scrollbar')).toBe(true);
    expect(scrollContainer?.classList.contains('overflow-x-auto')).toBe(true);
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

  it('permite selecionar um chip de plataforma sem bloquear a digitação livre', async () => {
    const user = userEvent.setup();
    renderComponent();

    const tiktokChip = screen.getByRole('button', { name: /tiktok/i });
    await user.click(tiktokChip);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'https://instagram.com/p/123');
    expect(input.value).toBe('https://instagram.com/p/123');
  });
});
