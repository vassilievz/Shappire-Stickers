import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialOverflowMenu } from './SocialOverflowMenu';

describe('SocialOverflowMenu', () => {
  it('abre o menu no portal e fecha ao tocar no backdrop', () => {
    const onView = vi.fn();
    render(
      <SocialOverflowMenu
        actions={[
          { id: 'view', label: 'Ver álbum', onClick: onView },
          { id: 'delete', label: 'Excluir', danger: true, onClick: vi.fn() },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /more actions|mais ações/i }));
    const item = screen.getByRole('menuitem', { name: 'Ver álbum' });
    expect(item).toBeInTheDocument();
    expect(item.closest('[role="menu"]')).toHaveStyle({ position: 'fixed' });

    const backdrop = Array.from(document.body.querySelectorAll('button')).find(
      (el) => el.className.includes('fixed') && el.className.includes('inset-0'),
    );
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('menuitem', { name: 'Ver álbum' })).toBeNull();
    expect(onView).not.toHaveBeenCalled();
  });

  it('executa a ação e fecha ao escolher um item', () => {
    const onView = vi.fn();
    render(<SocialOverflowMenu actions={[{ id: 'view', label: 'Ver álbum', onClick: onView }]} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions|mais ações/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver álbum' }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Ver álbum' })).toBeNull();
  });

  it('não propaga clique do botão trigger', () => {
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <SocialOverflowMenu actions={[{ id: 'a', label: 'Ação', onClick: vi.fn() }]} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /more actions|mais ações/i }));
    expect(onCard).not.toHaveBeenCalled();
  });
});
