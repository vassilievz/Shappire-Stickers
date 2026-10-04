import { STORAGE_ROOT } from '@/config/storage';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from '@/services/storage/gateway';
import { loadPacks } from '@/services/storage/packRepository';
import { loadProjectSummaries } from '@/services/storage/projectRepository';

const log = createLogger('storage-stats');


export interface StorageBreakdown {
  projectsBytes: number;
  packsBytes: number;
  cacheBytes: number;
  tempBytes: number;
  libraryBytes: number;
  totalBytes: number;
  measured: boolean;
  measuredAt: string;
}

export interface CleanupResult {
  freedBytes: number;
  removedFiles: number;
  removedDirectories: number;
}

interface DirectoryMeasurement {
  bytes: number;
  files: number;
  directories: number;
}

const EMPTY_MEASUREMENT: DirectoryMeasurement = { bytes: 0, files: 0, directories: 0 };

async function measureDirectory(path: string): Promise<DirectoryMeasurement> {
  const gateway = getFileSystemGateway();
  const entries = await gateway.readDir(path);
  let bytes = 0;
  let files = 0;
  let directories = 0;

  for (const entry of entries) {
    const childPath = `${path}/${entry.name}`;
    if (entry.type === 'directory') {
      const sub = await measureDirectory(childPath);
      bytes += sub.bytes;
      files += sub.files;
      directories += sub.directories + 1;
      continue;
    }
    let size = entry.sizeBytes;
    if (!size) {
      const stat = await gateway.stat(childPath);
      size = stat?.sizeBytes ?? 0;
    }
    bytes += size;
    files += 1;
  }

  return { bytes, files, directories };
}

async function safeMeasure(path: string): Promise<DirectoryMeasurement> {
  const gateway = getFileSystemGateway();
  try {
    if (!(await gateway.exists(path))) return EMPTY_MEASUREMENT;
    return await measureDirectory(path);
  } catch (error) {
    log.warn(`Falha ao medir ${path}`, error);
    return EMPTY_MEASUREMENT;
  }
}

export async function computeStorageBreakdown(): Promise<StorageBreakdown> {
  const [projects, packs, cache, temp, library] = await Promise.all([
    safeMeasure(STORAGE_ROOT.projectsDir),
    safeMeasure(STORAGE_ROOT.whatsappPacksDir),
    safeMeasure(STORAGE_ROOT.cacheDir),
    safeMeasure(STORAGE_ROOT.tempDir),
    safeMeasure('library'),
  ]);

  const totalBytes = projects.bytes + packs.bytes + cache.bytes + temp.bytes + library.bytes;

  return {
    projectsBytes: projects.bytes,
    packsBytes: packs.bytes,
    cacheBytes: cache.bytes,
    tempBytes: temp.bytes,
    libraryBytes: library.bytes,
    totalBytes,
    measured: true,
    measuredAt: new Date().toISOString(),
  };
}

export async function measureRecreatableCache(): Promise<number> {
  const measurement = await safeMeasure(STORAGE_ROOT.cacheDir);
  return measurement.bytes;
}

export async function cleanRecreatableCache(): Promise<CleanupResult> {
  const gateway = getFileSystemGateway();
  const before = await safeMeasure(STORAGE_ROOT.cacheDir);
  const cacheExists = await gateway.exists(STORAGE_ROOT.cacheDir);
  if (!cacheExists) {
    return { freedBytes: 0, removedFiles: 0, removedDirectories: 0 };
  }
  try {
    await gateway.deleteDirectory(STORAGE_ROOT.cacheDir, true);
  } catch (error) {
    log.warn('Falha ao limpar o cache', error);
    return { freedBytes: 0, removedFiles: 0, removedDirectories: 0 };
  }
  log.info(`Cache limpo: ${before.bytes} bytes liberados.`);
  return {
    freedBytes: before.bytes,
    removedFiles: before.files,
    removedDirectories: before.directories,
  };
}

async function removeOrphanDirectories(
  parentPath: string,
  knownIds: ReadonlySet<string>,
): Promise<CleanupResult> {
  const gateway = getFileSystemGateway();
  let result: CleanupResult = { freedBytes: 0, removedFiles: 0, removedDirectories: 0 };
  let entries: Awaited<ReturnType<typeof gateway.readDir>>;
  try {
    entries = await gateway.readDir(parentPath);
  } catch (error) {
    log.warn(`Falha ao ler ${parentPath}`, error);
    return result;
  }

  for (const entry of entries) {
    if (entry.type !== 'directory') continue;
    if (knownIds.has(entry.name)) continue;
    const childPath = `${parentPath}/${entry.name}`;
    const measurement = await safeMeasure(childPath);
    try {
      await gateway.deleteDirectory(childPath, true);
      result = {
        freedBytes: result.freedBytes + measurement.bytes,
        removedFiles: result.removedFiles + measurement.files,
        removedDirectories: result.removedDirectories + measurement.directories + 1,
      };
      log.info(`Diretório órfão removido: ${childPath}`);
    } catch (error) {
      log.warn(`Falha ao remover diretório órfão ${childPath}`, error);
    }
  }
  return result;
}

export async function cleanAbandonedFiles(): Promise<CleanupResult> {
  const gateway = getFileSystemGateway();
  const [summaries, packs] = await Promise.all([loadProjectSummaries(), loadPacks()]);
  const projectIds = new Set(summaries.map((summary) => summary.id));
  const packIds = new Set(packs.map((pack) => pack.id));

  const tempMeasurement = await safeMeasure(STORAGE_ROOT.tempDir);
  let result: CleanupResult = { freedBytes: 0, removedFiles: 0, removedDirectories: 0 };
  try {
    if (await gateway.exists(STORAGE_ROOT.tempDir)) {
      await gateway.deleteDirectory(STORAGE_ROOT.tempDir, true);
      result = {
        freedBytes: tempMeasurement.bytes,
        removedFiles: tempMeasurement.files,
        removedDirectories: tempMeasurement.directories,
      };
    }
  } catch (error) {
    log.warn('Falha ao limpar arquivos temporários', error);
  }

  const orphanProjects = await removeOrphanDirectories(STORAGE_ROOT.projectsDir, projectIds);
  const orphanPacks = await removeOrphanDirectories(STORAGE_ROOT.whatsappPacksDir, packIds);

  return {
    freedBytes: result.freedBytes + orphanProjects.freedBytes + orphanPacks.freedBytes,
    removedFiles: result.removedFiles + orphanProjects.removedFiles + orphanPacks.removedFiles,
    removedDirectories:
      result.removedDirectories + orphanProjects.removedDirectories + orphanPacks.removedDirectories,
  };
}
