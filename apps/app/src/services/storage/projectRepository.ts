import { APP_LIMITS } from '@/config/app';
import { SCHEMA_VERSION } from '@/config/storage';
import type { StickerProject } from '@/domain/project';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from './gateway';
import { readJson, writeJson } from './jsonStore';
import {
  projectAssetPath,
  projectAssetsDirectory,
  projectDirectory,
  projectDocumentPath,
  projectsIndexPath,
} from './paths';

const log = createLogger('project-repository');


export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  elementCount: number;
  thumbnail: string | null;
  packId: string | null;
  
  hidden: boolean;
}

interface ProjectIndexDocument {
  schemaVersion: number;
  updatedAt: string;
  projects: ProjectSummary[];
}

function toSummary(project: StickerProject, hidden = false): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    elementCount: project.elements.length,
    thumbnail: project.thumbnail,
    packId: project.packId,
    hidden,
  };
}

function isSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProjectSummary>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}


function sanitizeSummary(summary: ProjectSummary): ProjectSummary {
  return { ...summary, hidden: summary.hidden === true };
}

function isProject(value: unknown): value is StickerProject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StickerProject>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.elements)
  );
}

export async function loadProjectSummaries(): Promise<ProjectSummary[]> {
  const { data, corrupted } = await readJson<ProjectIndexDocument>(projectsIndexPath());
  if (corrupted) {
    log.warn('Índice de projetos corrompido; recomeçando com base vazia.');
    return [];
  }
  if (!data || !Array.isArray(data.projects)) return [];
  return data.projects
    .filter(isSummary)
    .map(sanitizeSummary)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export async function saveProjectSummaries(summaries: readonly ProjectSummary[]): Promise<void> {
  const document: ProjectIndexDocument = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    projects: [...summaries],
  };
  await writeJson(projectsIndexPath(), document);
}


export async function saveProject(project: StickerProject): Promise<ProjectSummary[]> {
  const gateway = getFileSystemGateway();
  await gateway.mkdir(projectDirectory(project.id));
  await writeJson(projectDocumentPath(project.id), project);

  const summaries = await loadProjectSummaries();
  const index = summaries.findIndex((item) => item.id === project.id);
  const existing = index >= 0 ? summaries[index] : undefined;
  const summary = toSummary(project, existing?.hidden === true);
  const merged =
    index >= 0 ? summaries.map((item, i) => (i === index ? summary : item)) : [summary, ...summaries];
  const sorted = [...merged]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, APP_LIMITS.maxStoredProjects);
  await saveProjectSummaries(sorted);
  return sorted;
}

export async function loadProject(projectId: string): Promise<StickerProject | null> {
  const { data, corrupted } = await readJson<StickerProject>(projectDocumentPath(projectId));
  if (corrupted || !data || !isProject(data)) return null;
  return data;
}

export async function deleteProject(projectId: string): Promise<ProjectSummary[]> {
  const gateway = getFileSystemGateway();
  const summaries = await loadProjectSummaries();
  const next = summaries.filter((item) => item.id !== projectId);
  await saveProjectSummaries(next);
  try {
    await gateway.deleteDirectory(projectDirectory(projectId), true);
  } catch (error) {
    log.warn(`Falha ao apagar arquivos do projeto ${projectId}`, error);
  }
  return next;
}


export async function writeProjectAsset(
  projectId: string,
  fileName: string,
  base64: string,
): Promise<string> {
  const gateway = getFileSystemGateway();
  await gateway.mkdir(projectAssetsDirectory(projectId));
  await gateway.writeBinaryFile(projectAssetPath(projectId, fileName), base64);
  return projectAssetPath(projectId, fileName);
}

export async function readProjectAssetBase64(projectId: string, fileName: string): Promise<string> {
  const gateway = getFileSystemGateway();
  const file = await gateway.readBinaryFile(projectAssetPath(projectId, fileName));
  return file.base64;
}

export async function projectAssetExists(projectId: string, fileName: string): Promise<boolean> {
  return getFileSystemGateway().exists(projectAssetPath(projectId, fileName));
}


export async function removeProjectAsset(projectId: string, fileName: string): Promise<void> {
  const gateway = getFileSystemGateway();
  await gateway.deleteFile(projectAssetPath(projectId, fileName));
}


export async function readAssetDataUrlByPath(path: string): Promise<string> {
  const gateway = getFileSystemGateway();
  const file = await gateway.readBinaryFile(path);
  const extension = path.split('.').pop()?.toLowerCase();
  const mime =
    extension === 'webp'
      ? 'image/webp'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : 'image/png';
  return `data:${mime};base64,${file.base64}`;
}

export async function setProjectHidden(projectId: string, hidden: boolean): Promise<ProjectSummary[]> {
  const summaries = await loadProjectSummaries();
  const next = summaries.map((item) => (item.id === projectId ? { ...item, hidden } : item));
  await saveProjectSummaries(next);
  return next;
}

export function summarize(project: StickerProject): ProjectSummary {
  return toSummary(project);
}
