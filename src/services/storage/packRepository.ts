import { SCHEMA_VERSION } from '@/config/storage';
import type { StickerPack } from '@/domain/stickerPack';
import { STICKER_AUTHOR, defaultPackLinks } from '@/domain/stickerPack';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from './gateway';
import { readJson, writeJson } from './jsonStore';
import { packDirectory, packsIndexPath } from './paths';

const log = createLogger('pack-repository');

interface PackIndexDocument {
  schemaVersion: number;
  updatedAt: string;
  packs: StickerPack[];
}

const EMPTY_INDEX: PackIndexDocument = {
  schemaVersion: SCHEMA_VERSION,
  updatedAt: new Date(0).toISOString(),
  packs: [],
};


function isStickerPack(value: unknown): value is StickerPack {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StickerPack>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.publisher === 'string' &&
    Array.isArray(candidate.stickers) &&
    typeof candidate.imageDataVersion === 'number'
  );
}


function sanitizePack(pack: StickerPack): StickerPack {
  const stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
  let stickerType = pack.stickerType ?? 'static';
  if (stickers.length > 0) {
    if (stickers.every((s) => !s.isAnimated)) {
      stickerType = 'static';
    } else if (stickers.every((s) => Boolean(s.isAnimated))) {
      stickerType = 'animated';
    }
  }

  return {
    ...pack,
    publisher: STICKER_AUTHOR,
    stickers,
    trayImage: pack.trayImage ?? null,
    stickerType,
    avoidCache: pack.avoidCache ?? true,
    contentHash: pack.contentHash ?? '',
    links: { ...defaultPackLinks(), ...(pack.links ?? {}) },
  };
}

export async function loadPacks(): Promise<StickerPack[]> {
  const { data, corrupted } = await readJson<PackIndexDocument>(packsIndexPath());
  if (corrupted) {
    log.warn('Índice de pacotes corrompido; recomeçando com base vazia.');
    return [];
  }
  if (!data || !Array.isArray(data.packs)) return [];
  return data.packs.filter(isStickerPack).map(sanitizePack);
}

export async function savePacks(packs: readonly StickerPack[]): Promise<void> {
  const document: PackIndexDocument = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    packs: [...packs],
  };
  await writeJson(packsIndexPath(), document);
}

export async function getPack(packId: string): Promise<StickerPack | null> {
  const packs = await loadPacks();
  return packs.find((pack) => pack.id === packId) ?? null;
}

export async function upsertPack(pack: StickerPack): Promise<StickerPack[]> {
  const packs = await loadPacks();
  const index = packs.findIndex((item) => item.id === pack.id);
  const next = index >= 0 ? packs.map((item, i) => (i === index ? pack : item)) : [...packs, pack];
  await savePacks(next);
  return next;
}


export async function deletePack(packId: string): Promise<StickerPack[]> {
  const gateway = getFileSystemGateway();
  const packs = await loadPacks();
  const next = packs.filter((pack) => pack.id !== packId);
  await savePacks(next);
  try {
    await gateway.deleteDirectory(packDirectory(packId), true);
  } catch (error) {
    log.warn(`Falha ao apagar arquivos do pacote ${packId}`, error);
  }
  return next;
}

export async function countPacks(): Promise<number> {
  return (await loadPacks()).length;
}

export function emptyPackIndexSnapshot(): PackIndexDocument {
  return { ...EMPTY_INDEX };
}
