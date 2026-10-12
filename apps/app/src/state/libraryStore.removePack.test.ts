import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStickerPack } from '@/domain/stickerPack';
import { useLibraryStore } from './libraryStore';

vi.mock('@/services/packs/packService', () => ({
  listPacks: vi.fn(async () => []),
  deletePack: vi.fn(async () => undefined),
  createPack: vi.fn(),
  renamePack: vi.fn(),
  readStickerDataUrl: vi.fn(),
}));

vi.mock('@/services/storage/projectRepository', () => ({
  loadProjectSummaries: vi.fn(async () => []),
}));

vi.mock('@/services/projects/projectService', () => ({
  hideProject: vi.fn(),
  restoreProject: vi.fn(),
  removeProjectPermanently: vi.fn(),
}));

import { deletePack } from '@/services/packs/packService';

describe('libraryStore.removePack', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      packs: [createStickerPack({ name: 'Test' })],
      packPreviews: {},
      status: 'ready',
      error: null,
    });
    vi.mocked(deletePack).mockClear();
  });

  it('remove pack locally without remote calls', async () => {
    await useLibraryStore.getState().removePack('pack-1');
    expect(deletePack).toHaveBeenCalledWith('pack-1');
    expect(useLibraryStore.getState().packs).toHaveLength(0);
  });
});
