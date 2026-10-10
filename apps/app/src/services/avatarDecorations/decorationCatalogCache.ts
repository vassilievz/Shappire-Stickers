import type { AvatarDecorationCatalogResponse } from '@shappire/contracts';

const STORAGE_KEY = 'shappire:avatar-decoration-catalog:v1';

export function readCachedCatalog(): AvatarDecorationCatalogResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AvatarDecorationCatalogResponse;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedCatalog(catalog: AvatarDecorationCatalogResponse): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
}
