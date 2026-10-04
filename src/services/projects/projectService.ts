import { createLogger } from '@/services/logging/logger';
import { loadPacks, savePacks } from '@/services/storage/packRepository';
import {
  deleteProject as deleteProjectRecord,
  setProjectHidden,
  type ProjectSummary,
} from '@/services/storage/projectRepository';
import { writeWhatsAppContents } from '@/services/whatsapp/stickerPackExporter';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

const log = createLogger('project-service');


export async function countProjectReferences(projectId: string): Promise<number> {
  const packs = await loadPacks();
  let count = 0;
  for (const pack of packs) {
    for (const sticker of pack.stickers) {
      if (sticker.projectId === projectId) count += 1;
    }
  }
  return count;
}

export async function clearProjectReferences(projectId: string): Promise<number> {
  const packs = await loadPacks();
  let cleared = 0;
  const next = packs.map((pack) => {
    let changed = false;
    const stickers = pack.stickers.map((sticker) => {
      if (sticker.projectId !== projectId) return sticker;
      changed = true;
      cleared += 1;
      return { ...sticker, projectId: null };
    });
    return changed ? { ...pack, stickers } : pack;
  });
  if (cleared > 0) {
    await savePacks(next);
    await writeWhatsAppContents(next);
    log.info(`Referências do projeto ${projectId} limpas em ${cleared} figurinha(s).`);
  }
  return cleared;
}

export async function hideProject(projectId: string): Promise<ProjectSummary[]> {
  return setProjectHidden(projectId, true);
}

export async function restoreProject(projectId: string): Promise<ProjectSummary[]> {
  return setProjectHidden(projectId, false);
}

export async function removeProjectPermanently(projectId: string): Promise<ProjectSummary[]> {
  try {
    await clearProjectReferences(projectId);
  } catch (error) {
    log.warn(`Falha ao limpar referências do projeto ${projectId}`, error);
  }
  const remaining = await deleteProjectRecord(projectId);
  log.info(`Projeto excluído definitivamente: ${projectId}`);
  return remaining;
}

export function projectOperationErrorMessage(error: unknown): string {
  return friendlyMessage(error);
}

export function notifyProjectError(error: unknown): void {
  log.warn('Falha em operação de projeto', error);
  showToast(friendlyMessage(error), 'error');
}
