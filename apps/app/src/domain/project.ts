import { APP_LIMITS } from '@/config/app';
import { EDITOR_CONFIG } from '@/config/editor';
import type { EditorElement } from '@/domain/editor/elements';
import { nowIso } from '@/shared/utils/format';
import { createId } from '@/shared/utils/id';


export interface StickerProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number };
  elements: EditorElement[];
  
  thumbnail: string | null;
  
  packId: string | null;
}

export function createProject(name: string): StickerProject {
  const timestamp = nowIso();
  return {
    id: createId('prj'),
    name: name.trim() === '' ? 'Nova figurinha' : name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    canvas: { width: EDITOR_CONFIG.canvasSize, height: EDITOR_CONFIG.canvasSize },
    elements: [],
    thumbnail: null,
    packId: null,
  };
}

export function touchProject(project: StickerProject, patch: Partial<StickerProject>): StickerProject {
  return { ...project, ...patch, updatedAt: nowIso() };
}

export function isEmptyProject(project: StickerProject): boolean {
  return project.elements.length === 0;
}


export function sortProjectsByRecent(
  projects: readonly StickerProject[],
  limit = APP_LIMITS.maxStoredProjects,
): StickerProject[] {
  return [...projects]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit);
}

export function sumElementCount(elements: readonly EditorElement[]): number {
  return elements.length;
}
