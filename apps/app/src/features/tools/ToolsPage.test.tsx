import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { ToolsPage, SHAPPIRE_TOOLS_URL } from './ToolsPage';
import * as externalLinksModule from '@/services/native/externalLinks';

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

  it('renderiza o título, o domínio e o botão de acesso ao shappire.tools', () => {
    renderComponent();

    expect(screen.getByText('Shappire Tools')).toBeInTheDocument();
    expect(screen.getAllByText('shappire.tools').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: /acessar shappire\.tools/i }),
    ).toBeInTheDocument();
  });

  it('abre o link externo do site https://shappire.tools/ ao clicar no botão', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(externalLinksModule, 'openExternalLink').mockReturnValue(true);

    renderComponent();

    const openBtn = screen.getByRole('button', { name: /acessar shappire\.tools/i });
    await user.click(openBtn);

    expect(openSpy).toHaveBeenCalledWith(SHAPPIRE_TOOLS_URL);
  });
});
