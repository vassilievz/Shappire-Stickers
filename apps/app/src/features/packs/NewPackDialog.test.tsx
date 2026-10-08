import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewPackDialog } from './NewPackDialog';
import { STICKER_AUTHOR } from '@/domain/stickerPack';
import { useLibraryStore } from '@/state/libraryStore';
import { createMemoryFileSystemGateway } from '@/services/storage/memoryFileSystem';
import { setFileSystemGateway } from '@/services/storage/gateway';

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
  useLibraryStore.setState({ packs: [], packPreviews: {} });
});

describe('NewPackDialog', () => {
  it('renderiza apenas o seletor de formato e o campo de nome do pacote, sem solicitar autor', () => {
    render(<NewPackDialog open={true} onClose={vi.fn()} />);

    const nameInput = screen.getByRole('textbox', { name: /nome do pacote|pack name/i });
    expect(nameInput).toBeInTheDocument();

    const authorInput = screen.queryByRole('textbox', { name: /autor|author|seu nome ou apelido/i });
    expect(authorInput).toBeNull();

    const allTextboxes = screen.getAllByRole('textbox');
    expect(allTextboxes).toHaveLength(1);
  });

  it('cria o pacote com o nome informado e atribui a autoria fixa automaticamente', async () => {
    const user = userEvent.setup();
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    render(<NewPackDialog open={true} onClose={handleClose} onCreated={handleCreated} />);

    const nameInput = screen.getByRole('textbox', { name: /nome do pacote|pack name/i });
    await user.type(nameInput, 'Figurinhas Top');

    const submitBtn = screen.getByRole('button', { name: /criar pacote|create pack/i });
    await user.click(submitBtn);

    const packs = useLibraryStore.getState().packs;
    const createdPack = packs.find((p) => p.name === 'Figurinhas Top');
    expect(createdPack).toBeDefined();
    expect(createdPack?.publisher).toBe(STICKER_AUTHOR);
    expect(handleCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Figurinhas Top',
        publisher: STICKER_AUTHOR,
      }),
    );
    expect(handleClose).toHaveBeenCalled();
  });
});
