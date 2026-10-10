import { create } from 'zustand';
import type { CreateStickerPackInput, StickerPack } from '@/domain/stickerPack';
import {
  createPack as createPackService,
  deletePack as deletePackService,
  listPacks,
  readStickerDataUrl,
  renamePack as renamePackService,
} from '@/services/packs/packService';
import { createLogger } from '@/services/logging/logger';
import {
  hideProject as hideProjectRecord,
  removeProjectPermanently,
  restoreProject as restoreProjectRecord,
} from '@/services/projects/projectService';
import { loadProjectSummaries, type ProjectSummary } from '@/services/storage/projectRepository';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from './toastStore';
import { deletePublication } from '@/services/api/socialApi';
import {
  getPackSocial,
  isImportedPackSocial,
  removePackSocial,
} from '@/services/storage/packSocialRepository';
import { useAuthStore } from './authStore';
import { useCommunityStore } from './communityStore';

const log = createLogger('library');

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LibraryState {
  packs: StickerPack[];
  projects: ProjectSummary[];
  
  hiddenProjects: ProjectSummary[];
  
  packPreviews: Record<string, string>;
  stickerPreviews: Record<string, string>;
  status: LibraryStatus;
  error: string | null;

  refresh: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  createPack: (input: CreateStickerPackInput) => Promise<StickerPack>;
  renamePack: (packId: string, patch: { name?: string }) => Promise<void>;
  removePack: (packId: string) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  getPackPreview: (packId: string) => Promise<string | null>;
  getStickerPreview: (packId: string, fileName: string) => Promise<string | null>;
  
  refreshPreviews: () => Promise<void>;
  
  hideProject: (projectId: string) => Promise<void>;
  
  restoreProject: (projectId: string) => Promise<void>;
  
  invalidatePreviewCaches: () => void;
}

function splitProjects(summaries: ProjectSummary[]): {
  projects: ProjectSummary[];
  hiddenProjects: ProjectSummary[];
} {
  const active: ProjectSummary[] = [];
  const hidden: ProjectSummary[] = [];
  for (const summary of summaries) {
    (summary.hidden ? hidden : active).push(summary);
  }
  return { projects: active, hiddenProjects: hidden };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  packs: [],
  projects: [],
  hiddenProjects: [],
  packPreviews: {},
  stickerPreviews: {},
  status: 'idle',
  error: null,

  refresh: async () => {
    set({ status: 'loading', error: null });
    try {
      const packs = await listPacks();
      const { projects, hiddenProjects } = splitProjects(await loadProjectSummaries());
      set({ packs, projects, hiddenProjects, status: 'ready' });
      void get().refreshPreviews();
    } catch (error) {
      log.warn('Falha ao carregar biblioteca', error);
      set({ status: 'error', error: friendlyMessage(error) });
    }
  },

  refreshProjects: async () => {
    try {
      const { projects, hiddenProjects } = splitProjects(await loadProjectSummaries());
      set({ projects, hiddenProjects });
    } catch (error) {
      log.warn('Falha ao carregar projetos', error);
    }
  },

  createPack: async (input) => {
    const { pack } = await createPackService(input);
    set({ packs: [...get().packs, pack] });
    return pack;
  },

  renamePack: async (packId, patch) => {
    await renamePackService(packId, patch);
    await get().refresh();
  },

  removePack: async (packId) => {
    const social = await getPackSocial(packId);
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (social?.publicationId && isAuthenticated && !isImportedPackSocial(social)) {
      try {
        await deletePublication(social.publicationId);
        useCommunityStore.getState().markPublicationRemoved(social.publicationId);
        await removePackSocial(packId);
      } catch (err) {
        showToast(friendlyMessage(err), 'error');
        throw err;
      }
    } else if (social) {
      await removePackSocial(packId);
    }
    await deletePackService(packId);
    set((state) => {
      const { [packId]: _removed, ...packPreviews } = state.packPreviews;
      void _removed;
      return { ...state, packPreviews, packs: state.packs.filter((pack) => pack.id !== packId) };
    });
    await get().refresh();
  },

  hideProject: async (projectId) => {
    const summaries = await hideProjectRecord(projectId);
    set(splitProjects(summaries));
  },

  restoreProject: async (projectId) => {
    const summaries = await restoreProjectRecord(projectId);
    set(splitProjects(summaries));
  },

  removeProject: async (projectId) => {
    const summaries = await removeProjectPermanently(projectId);
    set((state) => {
      const { [projectId]: _removed, ...stickerPreviews } = state.stickerPreviews;
      void _removed;
      return { ...splitProjects(summaries), stickerPreviews };
    });
    await get().refresh();
  },

  invalidatePreviewCaches: () => {
    set({ packPreviews: {}, stickerPreviews: {} });
  },

  getPackPreview: async (packId) => {
    const cached = get().packPreviews[packId];
    if (cached) return cached;
    const pack = get().packs.find((item) => item.id === packId);
    if (!pack) return null;
    const fileName = pack.trayImage?.fileName ?? pack.stickers[0]?.fileName;
    if (!fileName) return null;
    try {
      const dataUrl = await readStickerDataUrl(packId, fileName);
      set((state) => ({ packPreviews: { ...state.packPreviews, [packId]: dataUrl } }));
      return dataUrl;
    } catch (error) {
      log.warn('Falha ao gerar prévia do pacote', error);
      return null;
    }
  },

  getStickerPreview: async (packId, fileName) => {
    const key = `${packId}/${fileName}`;
    const cached = get().stickerPreviews[key];
    if (cached) return cached;
    try {
      const dataUrl = await readStickerDataUrl(packId, fileName);
      set((state) => ({ stickerPreviews: { ...state.stickerPreviews, [key]: dataUrl } }));
      return dataUrl;
    } catch (error) {
      log.warn('Falha ao ler figurinha', error);
      showToast(friendlyMessage(error), 'error');
      return null;
    }
  },

  
  refreshPreviews: async () => {
    const packs = get().packs.slice(0, 6);
    for (const pack of packs) {
      await get().getPackPreview(pack.id);
    }
  },
}));
