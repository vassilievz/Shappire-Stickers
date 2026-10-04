import { TRAY_FILE_NAME, WHATSAPP_LIMITS } from '@/config/whatsapp';
import {
  canCreateAnotherPack,
  createStickerPack,
  nextStickerFileName,
  packCapacity,
  updateStickerPack,
  type CreateStickerPackInput,
  type StickerPack,
  type StickerRecord,
} from '@/domain/stickerPack';
import { disposeCanvas } from '@/services/imaging/canvas';
import {
  exportStickerFromDataUrl,
  exportTrayIconFromCanvas,
  type ExportedStickerArtwork,
} from '@/services/imaging/exportSticker';
import { decodeImageFromDataUrl } from '@/services/imaging/imageLoader';
import { createLogger } from '@/services/logging/logger';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/utils/format';
import { createId } from '@/shared/utils/id';
import {
  deletePack as deletePackRecord,
  getPack,
  loadPacks,
  savePacks,
} from '@/services/storage/packRepository';
import { getFileSystemGateway } from '@/services/storage/gateway';
import { packStickerPath } from '@/services/storage/paths';
import {
  deleteStickerFile,
  deleteTrayFile,
  writeStickerFile,
  writeTrayFile,
  writeWhatsAppContents,
} from '@/services/whatsapp/stickerPackExporter';

const log = createLogger('pack-service');


async function persistPack(packs: readonly StickerPack[]): Promise<StickerPack[]> {
  await savePacks(packs);
  await writeWhatsAppContents(packs);
  return [...packs];
}

export async function listPacks(): Promise<StickerPack[]> {
  const packs = await loadPacks();
  return packs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export async function getPackById(packId: string): Promise<StickerPack | null> {
  return getPack(packId);
}

export async function createPack(
  input: CreateStickerPackInput,
): Promise<{ pack: StickerPack; packs: StickerPack[] }> {
  const packs = await loadPacks();
  if (!canCreateAnotherPack(packs.length)) {
    throw new AppError(
      'PACK_LIMIT_REACHED',
      `Limite de ${WHATSAPP_LIMITS.MAX_PACKS_PER_APP} pacotes por aplicativo atingido.`,
    );
  }
  const pack = createStickerPack(input);
  if (pack.name === '') {
    throw new AppError('INVALID_INPUT', 'Informe o nome do pacote.');
  }
  const next = [...packs, pack];
  await persistPack(next);
  log.info(`Pacote criado: ${pack.id}`);
  return { pack, packs: next };
}

export async function renamePack(
  packId: string,
  patch: { name?: string },
): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const current = packs[index];
  if (!current) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');
  const updated = updateStickerPack(current, {
    name: patch.name?.trim() || current.name,
  });
  const next = packs.map((pack, i) => (i === index ? updated : pack));
  await persistPack(next);
  return updated;
}

export async function deletePack(packId: string): Promise<StickerPack[]> {
  const packs = await loadPacks();
  const pack = packs.find((item) => item.id === packId);
  if (pack?.trayImage) {
    await deleteTrayFile(packId, pack.trayImage.fileName);
  }
  if (pack) {
    for (const sticker of pack.stickers) {
      await deleteStickerFile(packId, sticker.fileName);
    }
  }
  const remaining = await deletePackRecord(packId);
  await writeWhatsAppContents(remaining);
  log.info(`Pacote excluído: ${packId}`);
  return remaining;
}

export interface AddStickerInput {
  packId: string;
  artwork: ExportedStickerArtwork;
  emojis?: string[];
  accessibilityText?: string;
  projectId?: string | null;
  hasDrawing?: boolean;
  isAnimated?: boolean;
  durationMs?: number;
}

function normalizeEmojis(emojis?: string[]): string[] {
  const clean = (emojis ?? [])
    .map((emoji) => emoji.trim())
    .filter((emoji) => emoji !== '')
    .slice(0, WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER);
  return clean.length > 0 ? clean : ['✨'];
}


export async function addStickerToPack(
  input: AddStickerInput,
): Promise<{ pack: StickerPack; sticker: StickerRecord }> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === input.packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');

  const capacity = packCapacity(pack);
  if (!capacity.allowed) {
    throw new AppError(capacity.code ?? 'PACK_TOO_MANY_STICKERS', capacity.reason ?? 'Pacote cheio.');
  }

  const fileName = nextStickerFileName(pack);
  const { sizeBytes } = await writeStickerFile(pack.id, {
    fileName,
    base64: input.artwork.base64,
  });

  const isAnimated = input.isAnimated ?? false;
  const sticker: StickerRecord = {
    id: createId('stk'),
    fileName,
    width: input.artwork.width,
    height: input.artwork.height,
    sizeBytes,
    emojis: normalizeEmojis(input.emojis),
    accessibilityText: (input.accessibilityText ?? '').trim(),
    createdAt: nowIso(),
    projectId: input.projectId ?? null,
    hasDrawing: input.hasDrawing ?? false,
    isAnimated,
    durationMs: input.durationMs,
  };

  const tray =
    pack.trayImage ?? (await buildTrayFromStickerFile(pack.id, sticker));

  const updated = updateStickerPack(pack, {
    stickers: [...pack.stickers, sticker],
    trayImage: tray,
    stickerType: isAnimated ? 'animated' : pack.stickerType,
  });
  const next = packs.map((item, i) => (i === index ? updated : item));
  await persistPack(next);
  log.info(`Figurinha adicionada ao pacote ${pack.id} (${sizeBytes} bytes${isAnimated ? ' · animada' : ''})`);
  return { pack: updated, sticker };
}


export async function addExistingImageToPack(input: {
  packId: string;
  dataUrl: string;
  emojis?: string[];
  accessibilityText?: string;
}): Promise<{ pack: StickerPack; sticker: StickerRecord }> {
  const isGif = input.dataUrl.startsWith('data:image/gif') || input.dataUrl.includes('image/gif');
  if (isGif) {
    const { exportAnimatedStickerFromGifDataUrl } = await import('@/services/imaging/exportSticker');
    const artwork = await exportAnimatedStickerFromGifDataUrl(input.dataUrl);
    return addStickerToPack({
      packId: input.packId,
      artwork,
      emojis: input.emojis,
      accessibilityText: input.accessibilityText,
      projectId: null,
      hasDrawing: false,
      isAnimated: true,
      durationMs: artwork.durationMs,
    });
  }

  const artwork = await exportStickerFromDataUrl(input.dataUrl);
  return addStickerToPack({
    packId: input.packId,
    artwork,
    emojis: input.emojis,
    accessibilityText: input.accessibilityText,
    projectId: null,
    hasDrawing: false,
  });
}

export async function removeStickerFromPack(packId: string, stickerId: string): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');
  const sticker = pack.stickers.find((item) => item.id === stickerId);
  if (!sticker) throw new AppError('NOT_FOUND', 'Figurinha não encontrada.');

  await deleteStickerFile(packId, sticker.fileName);

  const remaining = pack.stickers.filter((item) => item.id !== stickerId);
  const keepTray = pack.trayImage?.fileName ? pack.trayImage : null;
  const tray =
    remaining.length === 0 && keepTray
      ? await removeTrayAndFile(packId, keepTray.fileName)
      : keepTray;

  const updated = updateStickerPack(pack, { stickers: remaining, trayImage: tray });
  const next = packs.map((item, i) => (i === index ? updated : item));
  await persistPack(next);
  return updated;
}


export async function reorderStickers(packId: string, orderedIds: readonly string[]): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');

  const byId = new Map(pack.stickers.map((sticker) => [sticker.id, sticker]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((sticker): sticker is StickerRecord => sticker !== undefined);
  const missing = pack.stickers.filter((sticker) => !orderedIds.includes(sticker.id));
  const updated = updateStickerPack(pack, { stickers: [...ordered, ...missing] });
  const next = packs.map((item, i) => (i === index ? updated : item));
  await persistPack(next);
  return updated;
}


export async function updateStickerMeta(
  packId: string,
  stickerId: string,
  patch: { emojis?: string[]; accessibilityText?: string },
): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');

  const stickers = pack.stickers.map((sticker) =>
    sticker.id === stickerId
      ? {
          ...sticker,
          emojis: patch.emojis ? normalizeEmojis(patch.emojis) : sticker.emojis,
          accessibilityText:
            patch.accessibilityText !== undefined
              ? patch.accessibilityText.trim()
              : sticker.accessibilityText,
        }
      : sticker,
  );
  const updated = updateStickerPack(pack, { stickers });
  const next = packs.map((item, i) => (i === index ? updated : item));
  await persistPack(next);
  return updated;
}


export async function readStickerDataUrl(packId: string, fileName: string): Promise<string> {
  const file = await getFileSystemGateway().readBinaryFile(packStickerPath(packId, fileName));
  const mime = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/webp';
  return `data:${mime};base64,${file.base64}`;
}


export async function buildTrayFromStickerFile(
  packId: string,
  sticker: StickerRecord,
): Promise<StickerPack['trayImage']> {
  try {
    const dataUrl = await readStickerDataUrl(packId, sticker.fileName);
    const decoded = await decodeImageFromDataUrl(dataUrl);
    try {
      const tray = await exportTrayIconFromCanvas(decoded.canvas);
      const fileName = tray.format === 'image/png' ? TRAY_FILE_NAME : 'tray.webp';
      await writeTrayFile(packId, fileName, tray.base64);
      return { fileName, sizeBytes: tray.sizeBytes, width: tray.width, height: tray.height };
    } finally {
      disposeCanvas(decoded.canvas);
    }
  } catch (error) {
    log.warn('Falha ao gerar ícone da bandeja a partir da figurinha', error);
    return null;
  }
}

async function removeTrayAndFile(packId: string, fileName: string): Promise<null> {
  await deleteTrayFile(packId, fileName);
  return null;
}


export async function setTrayFromSticker(packId: string, stickerId: string): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');
  const sticker = pack.stickers.find((item) => item.id === stickerId);
  if (!sticker) throw new AppError('NOT_FOUND', 'Figurinha não encontrada.');

  const tray = await buildTrayFromStickerFile(packId, sticker);
  if (!tray) {
    throw new AppError('IMAGE_ENCODE_FAILED', 'Não foi possível gerar o ícone do pacote.');
  }
  const updated = updateStickerPack(pack, { trayImage: tray });
  const next = packs.map((item, i) => (i === index ? updated : item));
  await persistPack(next);
  return updated;
}


export async function setTrayFromDataUrl(packId: string, dataUrl: string): Promise<StickerPack> {
  const packs = await loadPacks();
  const index = packs.findIndex((pack) => pack.id === packId);
  const pack = packs[index];
  if (!pack) throw new AppError('NOT_FOUND', 'Pacote não encontrado.');

  const decoded = await decodeImageFromDataUrl(dataUrl);
  try {
    const tray = await exportTrayIconFromCanvas(decoded.canvas);
    const fileName = tray.format === 'image/png' ? TRAY_FILE_NAME : 'tray.webp';
    await writeTrayFile(packId, fileName, tray.base64);
    const updated = updateStickerPack(pack, {
      trayImage: { fileName, sizeBytes: tray.sizeBytes, width: tray.width, height: tray.height },
    });
    const next = packs.map((item, i) => (i === index ? updated : item));
    await persistPack(next);
    return updated;
  } finally {
    disposeCanvas(decoded.canvas);
  }
}
