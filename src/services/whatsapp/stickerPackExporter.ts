import type { StickerPack } from '@/domain/stickerPack';
import type { StickerFileInfo } from '@/domain/validation/whatsappRules';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from '@/services/storage/gateway';
import {
  packDirectory,
  packStickerPath,
  packTrayPath,
  whatsappContentsPath,
} from '@/services/storage/paths';
import {
  buildContentsDocument,
  serializeContentsDocument,
  type ContentsDocumentLinks,
} from './contentsFile';

const log = createLogger('whatsapp-exporter');


export interface BinaryFileInput {
  fileName: string;
  base64: string;
}

export async function ensurePackDirectory(packId: string): Promise<void> {
  await getFileSystemGateway().mkdir(packDirectory(packId));
}

export async function writeStickerFile(
  packId: string,
  file: BinaryFileInput,
): Promise<{ path: string; sizeBytes: number }> {
  const gateway = getFileSystemGateway();
  await ensurePackDirectory(packId);
  const path = packStickerPath(packId, file.fileName);
  await gateway.writeBinaryFile(path, file.base64);
  const stat = await gateway.stat(path);
  return { path, sizeBytes: stat?.sizeBytes ?? 0 };
}

export async function writeTrayFile(
  packId: string,
  fileName: string,
  base64: string,
): Promise<void> {
  const gateway = getFileSystemGateway();
  await ensurePackDirectory(packId);
  await gateway.writeBinaryFile(packTrayPath(packId, fileName), base64);
}

export async function deleteStickerFile(packId: string, fileName: string): Promise<void> {
  try {
    await getFileSystemGateway().deleteFile(packStickerPath(packId, fileName));
  } catch (error) {
    log.warn(`Falha ao apagar figurinha ${fileName}`, error);
  }
}

export async function deleteTrayFile(packId: string, fileName: string): Promise<void> {
  try {
    await getFileSystemGateway().deleteFile(packTrayPath(packId, fileName));
  } catch (error) {
    log.warn('Falha ao apagar ícone do pacote', error);
  }
}

export async function writeWhatsAppContents(
  packs: readonly StickerPack[],
  links: ContentsDocumentLinks = {},
): Promise<void> {
  const document = buildContentsDocument(packs, links);
  await getFileSystemGateway().mkdir('sticker_packs');
  await getFileSystemGateway().writeTextFile(whatsappContentsPath(), serializeContentsDocument(document));
}


export async function readStickerFileInfo(
  packId: string,
  fileName: string,
  dimensions: { width: number; height: number },
): Promise<StickerFileInfo | null> {
  const gateway = getFileSystemGateway();
  const stat = await gateway.stat(packStickerPath(packId, fileName));
  if (!stat || stat.type !== 'file') return null;
  return {
    fileName,
    sizeBytes: stat.sizeBytes,
    width: dimensions.width,
    height: dimensions.height,
  };
}


export async function readPackFilesInfo(pack: StickerPack): Promise<Map<string, StickerFileInfo>> {
  const result = new Map<string, StickerFileInfo>();
  for (const sticker of pack.stickers) {
    const info = await readStickerFileInfo(pack.id, sticker.fileName, {
      width: sticker.width,
      height: sticker.height,
    });
    if (info) result.set(sticker.fileName, info);
  }
  return result;
}

export async function trayFileExists(pack: StickerPack): Promise<boolean> {
  if (!pack.trayImage) return false;
  return getFileSystemGateway().exists(packTrayPath(pack.id, pack.trayImage.fileName));
}

export async function listPackFiles(packId: string): Promise<{ name: string; sizeBytes: number }[]> {
  const entries = await getFileSystemGateway().readDir(packDirectory(packId));
  return entries
    .filter((entry) => entry.type === 'file')
    .map((entry) => ({ name: entry.name, sizeBytes: entry.sizeBytes }));
}


export async function computeWhatsAppStorageBytes(): Promise<number> {
  const gateway = getFileSystemGateway();
  const packsEntries = await gateway.readDir('sticker_packs');
  let total = 0;
  for (const entry of packsEntries) {
    if (entry.type === 'file') {
      total += entry.sizeBytes;
      continue;
    }
    const files = await listPackFiles(entry.name);
    total += files.reduce((sum, file) => sum + file.sizeBytes, 0);
  }
  return total;
}
