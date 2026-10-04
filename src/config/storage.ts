
export const STORAGE_ROOT = {
  directory: 'DATA',
  
  packsIndex: 'library/packs.json',
  projectsIndex: 'library/projects.json',
  settings: 'library/settings.json',
  
  projectsDir: 'projects',
  
  whatsappPacksDir: 'sticker_packs',
  whatsappContentsFile: 'sticker_packs/contents.json',
  
  thumbnailsDir: 'cache/thumbnails',
  
  cacheDir: 'cache',
  
  tempDir: 'tmp',
} as const;

export const SCHEMA_VERSION = 1;
