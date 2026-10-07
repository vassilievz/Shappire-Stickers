import JSZip from 'jszip';
import { getPack, upsertPack } from '@/services/storage/packRepository';
import { getFileSystemGateway } from '@/services/storage/gateway';
import { packStickerPath, packTrayPath } from '@/services/storage/paths';
import { writeStickerFile, writeTrayFile, writeWhatsAppContents } from '@/services/whatsapp/stickerPackExporter';
import { listPacks } from './packService';
import { AppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { createId, createPackIdentifier } from '@/shared/utils/id';
import { nowIso } from '@/shared/utils/format';
import type { StickerPack, StickerRecord, TrayImageRecord } from '@/domain/stickerPack';

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

const log = createLogger('pack-backup-service');

export interface ExportedPackArchive {
  fileName: string;
  blob: Blob;
}

/**
 * Creates a .zip Blob containing the pack manifest (pack.json),
 * all sticker .webp files, and the tray icon.
 */
export async function createPackZip(packId: string): Promise<ExportedPackArchive> {
  const pack = await getPack(packId);
  if (!pack) {
    throw new AppError('NOT_FOUND', 'Pacote não encontrado para exportação.');
  }

  const gateway = getFileSystemGateway();
  const zip = new JSZip();

  // 1. Add manifest
  zip.file('pack.json', JSON.stringify(pack, null, 2));

  // 2. Add stickers
  for (const sticker of pack.stickers) {
    try {
      const path = packStickerPath(pack.id, sticker.fileName);
      const binary = await gateway.readBinaryFile(path);
      zip.file(sticker.fileName, binary.base64, { base64: true });
    } catch (err) {
      log.warn(`Não foi possível incluir a figurinha ${sticker.fileName} no backup:`, err);
    }
  }

  // 3. Add tray icon if exists
  if (pack.trayImage) {
    try {
      const trayPath = packTrayPath(pack.id, pack.trayImage.fileName);
      const trayBinary = await gateway.readBinaryFile(trayPath);
      zip.file(pack.trayImage.fileName, trayBinary.base64, { base64: true });
    } catch (err) {
      log.warn(`Não foi possível incluir a bandeja ${pack.trayImage.fileName} no backup:`, err);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = sanitizeFilename(pack.name || 'pacote');
  const fileName = `${safeName || 'pacote'}.shappire.zip`;

  return { fileName, blob };
}

/**
 * Triggers a browser download of the pack's zip archive.
 */
export async function downloadPackZip(packId: string): Promise<void> {
  const { fileName, blob } = await createPackZip(packId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Imports a pack from a .zip File or Blob.
 * Regenerates unique IDs if needed to avoid overwriting existing packs.
 */
export async function importPackFromZip(file: File | Blob): Promise<StickerPack> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('pack.json');
  if (!manifestFile) {
    throw new AppError('INVALID_INPUT', 'Arquivo ZIP inválido: pack.json não encontrado.');
  }

  const manifestText = await manifestFile.async('string');
  let originalPack: StickerPack;
  try {
    originalPack = JSON.parse(manifestText) as StickerPack;
  } catch (err) {
    throw new AppError('INVALID_INPUT', 'O arquivo pack.json está corrompido.', { cause: err });
  }

  const newPackId = createPackIdentifier();
  const timestamp = nowIso();

  const importedStickers: StickerRecord[] = [];
  for (const st of originalPack.stickers || []) {
    const stickerFile = zip.file(st.fileName);
    if (!stickerFile) continue;

    const base64 = await stickerFile.async('base64');
    await writeStickerFile(newPackId, {
      fileName: st.fileName,
      base64,
    });

    importedStickers.push({
      ...st,
      id: createId('stk'),
      createdAt: timestamp,
      projectId: null,
    });
  }

  let importedTray: TrayImageRecord | null = null;
  if (originalPack.trayImage) {
    const trayFile = zip.file(originalPack.trayImage.fileName);
    if (trayFile) {
      const trayBase64 = await trayFile.async('base64');
      await writeTrayFile(newPackId, originalPack.trayImage.fileName, trayBase64);
      importedTray = { ...originalPack.trayImage };
    }
  }

  const newPack: StickerPack = {
    ...originalPack,
    id: newPackId,
    name: `${originalPack.name} (importado)`.slice(0, 30),
    stickers: importedStickers,
    trayImage: importedTray,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await upsertPack(newPack);
  const allPacks = await listPacks();
  await writeWhatsAppContents(allPacks);

  return newPack;
}
