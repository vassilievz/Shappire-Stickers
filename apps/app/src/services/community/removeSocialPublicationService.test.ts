import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/socialApi', () => ({
  deletePublication: vi.fn(),
}));

vi.mock('@/services/storage/packSocialRepository', () => ({
  findPackIdByPublicationId: vi.fn(),
  removePackSocial: vi.fn(),
}));

vi.mock('@/state/communityStore', () => ({
  useCommunityStore: {
    getState: vi.fn(() => ({ markPublicationRemoved: vi.fn() })),
  },
}));

import { deletePublication } from '@/services/api/socialApi';
import { findPackIdByPublicationId, removePackSocial } from '@/services/storage/packSocialRepository';
import { useCommunityStore } from '@/state/communityStore';
import { removeSocialPublication } from './removeSocialPublicationService';

describe('removeSocialPublication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remove publicação remota, marca cache e limpa vínculo local sem apagar pacote', async () => {
    const markPublicationRemoved = vi.fn();
    vi.mocked(useCommunityStore.getState).mockReturnValue({ markPublicationRemoved } as never);
    vi.mocked(findPackIdByPublicationId).mockResolvedValue('pack-1');

    await removeSocialPublication('pub-1');

    expect(deletePublication).toHaveBeenCalledWith('pub-1');
    expect(markPublicationRemoved).toHaveBeenCalledWith('pub-1');
    expect(removePackSocial).toHaveBeenCalledWith('pack-1');
  });

  it('não chama removePackSocial quando não há vínculo local', async () => {
    vi.mocked(useCommunityStore.getState).mockReturnValue({ markPublicationRemoved: vi.fn() } as never);
    vi.mocked(findPackIdByPublicationId).mockResolvedValue(null);

    await removeSocialPublication('pub-2');

    expect(removePackSocial).not.toHaveBeenCalled();
  });
});
