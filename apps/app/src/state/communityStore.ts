import { create } from 'zustand';

interface CommunityStoreState {
  listVersion: number;
  removedPublicationIds: string[];
  bumpListVersion: () => void;
  markPublicationRemoved: (publicationId: string) => void;
  clearRemoved: (publicationId: string) => void;
}

export const useCommunityStore = create<CommunityStoreState>((set) => ({
  listVersion: 0,
  removedPublicationIds: [],
  bumpListVersion: () => set((s) => ({ listVersion: s.listVersion + 1 })),
  markPublicationRemoved: (publicationId) =>
    set((s) => ({
      listVersion: s.listVersion + 1,
      removedPublicationIds: s.removedPublicationIds.includes(publicationId)
        ? s.removedPublicationIds
        : [...s.removedPublicationIds, publicationId],
    })),
  clearRemoved: (publicationId) =>
    set((s) => ({
      removedPublicationIds: s.removedPublicationIds.filter((id) => id !== publicationId),
    })),
}));
