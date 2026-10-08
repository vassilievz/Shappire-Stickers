import { CONTENTS_FILE_NAME, TRAY_FILE_NAME } from '@/config/whatsapp';
import { STORAGE_ROOT } from '@/config/storage';


export function packDirectory(packId: string): string {
  return `${STORAGE_ROOT.whatsappPacksDir}/${packId}`;
}

export function packContentsPath(packId: string): string {
  return `${packDirectory(packId)}/${CONTENTS_FILE_NAME}`;
}

export function packStickerPath(packId: string, fileName: string): string {
  return `${packDirectory(packId)}/${fileName}`;
}

export function packTrayPath(packId: string, fileName: string = TRAY_FILE_NAME): string {
  return `${packDirectory(packId)}/${fileName}`;
}

export function whatsappContentsPath(): string {
  return STORAGE_ROOT.whatsappContentsFile;
}

export function projectDirectory(projectId: string): string {
  return `${STORAGE_ROOT.projectsDir}/${projectId}`;
}

export function projectAssetsDirectory(projectId: string): string {
  return `${projectDirectory(projectId)}/assets`;
}

export function projectAssetPath(projectId: string, fileName: string): string {
  return `${projectAssetsDirectory(projectId)}/${fileName}`;
}

export function projectDocumentPath(projectId: string): string {
  return `${projectDirectory(projectId)}/project.json`;
}

export function packsIndexPath(): string {
  return STORAGE_ROOT.packsIndex;
}

export function projectsIndexPath(): string {
  return STORAGE_ROOT.projectsIndex;
}

export function settingsPath(): string {
  return STORAGE_ROOT.settings;
}

export function profileCachePath(uid: string): string {
  return `library/profile-${uid}.json`;
}


export function baseName(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}
