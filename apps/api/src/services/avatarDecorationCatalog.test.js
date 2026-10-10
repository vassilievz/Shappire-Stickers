import { describe, it, expect } from 'vitest';
import {
  getCatalogResponse,
  getDecorationById,
  isKnownDecorationId,
  parseCatalogItem,
} from './avatarDecorationCatalog.js';

describe('avatarDecorationCatalog', () => {
  it('carrega todos os itens válidos do manifesto', () => {
    const catalog = getCatalogResponse();
    expect(catalog.version).toBeGreaterThanOrEqual(1);
    expect(catalog.items.length).toBe(catalog.itemCount);
    expect(catalog.items.length).toBeGreaterThan(100);
    const ids = new Set(catalog.items.map((item) => item.id));
    expect(ids.size).toBe(catalog.items.length);
  });

  it('rejeita registros malformados', () => {
    expect(parseCatalogItem(null)).toBeNull();
    expect(parseCatalogItem({ id: '', url: 'https://x.com/a.png' })).toBeNull();
    expect(parseCatalogItem({ id: '1', url: 'ftp://bad' })).toBeNull();
  });

  it('resolve item por id estável', () => {
    const catalog = getCatalogResponse();
    const first = catalog.items[0];
    expect(isKnownDecorationId(first.id)).toBe(true);
    expect(getDecorationById(first.id)?.url).toBe(first.url);
  });
});
