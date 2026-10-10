import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StickerPack } from '@/domain/stickerPack';
import { useLibraryStore } from './libraryStore';
import { useAuthStore } from './authStore';
import { useCommunityStore } from './communityStore';

vi.mock('@/services/packs/packService', () => ({
  listPacks: vi.fn(async () => []),
  deletePack: vi.fn(async () => undefined),
  createPack: vi.fn(),
  renamePack: vi.fn(),
  readStickerDataUrl: vi.fn(),
}));

vi.mock('@/services/projects/projectService', () => ({
  hideProject: vi.fn(),
  removeProjectPermanently: vi.fn(),
  restoreProject: vi.fn(),
}));

vi.mock('@/services/storage/projectRepository', () => ({
  loadProjectSummaries: vi.fn(async () => []),
}));

vi.mock('@/services/storage/packSocialRepository', () => ({
  getPackSocial: vi.fn(),
  removePackSocial: vi.fn(async () => undefined),
  isImportedPackSocial: vi.fn((record: { importedAt?: string; sourceAuthorName?: string }) =>
    Boolean(record.importedAt || record.sourceAuthorName),
  ),
}));

vi.mock('@/services/community/removeSocialPublicationService', () => ({
  removeSocialPublication: vi.fn(),
}));

vi.mock('@/state/toastStore', () => ({
  showToast: vi.fn(),
}));

import { deletePack } from '@/services/packs/packService';
import { getPackSocial, removePackSocial } from '@/services/storage/packSocialRepository';
import { removeSocialPublication } from '@/services/community/removeSocialPublicationService';

const packId = 'pack-local-1';
const publicationId = '507f1f77bcf86cd799439011';

describe('libraryStore.removePack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { uid: 'user-1', displayName: 'U', email: 'u@x.com', photoURL: null },
      profile: null,
      isAuthenticated: true,
      isLoading: false,
      isSigningIn: false,
      error: null,
    });
    useCommunityStore.setState({ listVersion: 0, removedPublicationIds: [] });
    const pack = { id: packId, name: 'Test' } as StickerPack;
    useLibraryStore.setState({
      packs: [pack],
      projects: [],
      hiddenProjects: [],
      packPreviews: {},
      stickerPreviews: {},
      status: 'ready',
      error: null,
    });
  });

  it('pacote publicado chama removeSocialPublication antes de apagar localmente', async () => {
    vi.mocked(getPackSocial).mockResolvedValue({
      publicationId,
      visibility: 'public',
      lastSyncedAt: new Date().toISOString(),
    });
    vi.mocked(removeSocialPublication).mockImplementation(async (id) => {
      useCommunityStore.getState().markPublicationRemoved(id);
    });

    await useLibraryStore.getState().removePack(packId);

    expect(removeSocialPublication).toHaveBeenCalledWith(publicationId);
    expect(removePackSocial).not.toHaveBeenCalled();
    expect(deletePack).toHaveBeenCalledWith(packId);
    expect(useCommunityStore.getState().removedPublicationIds).toContain(publicationId);
  });

  it('falha no backend aborta e não apaga o pacote local', async () => {
    vi.mocked(getPackSocial).mockResolvedValue({
      publicationId,
      visibility: 'public',
      lastSyncedAt: new Date().toISOString(),
    });
    vi.mocked(removeSocialPublication).mockRejectedValue(new Error('network'));

    await expect(useLibraryStore.getState().removePack(packId)).rejects.toThrow('network');
    expect(deletePack).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().packs.some((p) => p.id === packId)).toBe(true);
  });

  it('cópia importada não chama removeSocialPublication', async () => {
    vi.mocked(getPackSocial).mockResolvedValue({
      publicationId,
      visibility: 'public',
      lastSyncedAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      sourceAuthorName: 'Autor',
    });

    await useLibraryStore.getState().removePack(packId);

    expect(removeSocialPublication).not.toHaveBeenCalled();
    expect(removePackSocial).toHaveBeenCalledWith(packId);
    expect(deletePack).toHaveBeenCalledWith(packId);
  });

  it('sem referência social apaga apenas localmente', async () => {
    vi.mocked(getPackSocial).mockResolvedValue(null);

    await useLibraryStore.getState().removePack(packId);

    expect(removeSocialPublication).not.toHaveBeenCalled();
    expect(deletePack).toHaveBeenCalledWith(packId);
  });
});
