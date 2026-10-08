import { STICKER_FILE_EXTENSION, WHATSAPP_LIMITS } from '@/config/whatsapp';
import type { AppErrorCode } from '@/shared/errors';
import { nowIso } from '@/shared/utils/format';
import { hashObject } from '@/shared/utils/hash';
import { createId, createPackIdentifier } from '@/shared/utils/id';


export type StickerType = 'static' | 'animated';


export interface StickerRecord {
  id: string;
  
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  emojis: string[];
  accessibilityText: string;
  createdAt: string;
  
  projectId: string | null;
  
  hasDrawing: boolean;
  
  isAnimated?: boolean;
  
  durationMs?: number;
}


export const STICKER_AUTHOR = 'IG・@vassilievz';


const LEGACY_CREATOR_CREDIT = 'Creator: IG @vassilievz';


export function sanitizeAccessibilityText(text?: string | null): string {
  const raw = (text ?? '').trim();
  if (raw === '') return '';
  return raw
    .split(LEGACY_CREATOR_CREDIT)
    .join('')
    .replace(/^[\s•]+/, '')
    .replace(/[\s•]+$/, '')
    .trim();
}

export interface TrayImageRecord {
  fileName: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface PackLinks {
  playStore: string;
  appStore: string;
  publisherEmail: string;
  publisherWebsite: string;
  privacyPolicy: string;
  licenseAgreement: string;
}

export interface StickerPack {
  
  id: string;
  name: string;
  publisher: string;
  stickerType: StickerType;
  stickers: StickerRecord[];
  trayImage: TrayImageRecord | null;
  
  imageDataVersion: number;
  
  contentHash: string;
  avoidCache: boolean;
  links: PackLinks;
  createdAt: string;
  updatedAt: string;
}

export interface StickerPackSummary {
  id: string;
  name: string;
  publisher: string;
  stickerCount: number;
  trayFileName: string | null;
  updatedAt: string;
  imageDataVersion: number;
}

export interface CreateStickerPackInput {
  name: string;
  stickerType?: StickerType;
}

export function defaultPackLinks(): PackLinks {
  return {
    playStore: '',
    appStore: '',
    publisherEmail: '',
    publisherWebsite: '',
    privacyPolicy: '',
    licenseAgreement: '',
  };
}

export function createStickerPack(input: CreateStickerPackInput): StickerPack {
  const timestamp = nowIso();
  const pack: StickerPack = {
    id: createPackIdentifier(),
    name: input.name.trim(),
    publisher: STICKER_AUTHOR,
    stickerType: input.stickerType ?? 'static',
    stickers: [],
    trayImage: null,
    imageDataVersion: 1,
    contentHash: '',
    avoidCache: true,
    links: defaultPackLinks(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { ...pack, contentHash: computePackContentHash(pack) };
}


export function computePackContentHash(pack: StickerPack): string {
  return hashObject({
    id: pack.id,
    name: pack.name,
    publisher: pack.publisher,
    stickerType: pack.stickerType,
    tray: pack.trayImage ? { file: pack.trayImage.fileName, size: pack.trayImage.sizeBytes } : null,
    avoidCache: pack.avoidCache,
    links: pack.links,
    stickers: pack.stickers.map((sticker) => ({
      file: sticker.fileName,
      size: sticker.sizeBytes,
      emojis: sticker.emojis,
      accessibilityText: sticker.accessibilityText,
    })),
  });
}


export function updateStickerPack(pack: StickerPack, patch: Partial<StickerPack>): StickerPack {
  const candidate: StickerPack = { ...pack, ...patch, publisher: STICKER_AUTHOR, updatedAt: nowIso() };
  const nextHash = computePackContentHash(candidate);
  if (nextHash === pack.contentHash) {
    return { ...candidate, contentHash: nextHash, imageDataVersion: pack.imageDataVersion };
  }
  return { ...candidate, contentHash: nextHash, imageDataVersion: pack.imageDataVersion + 1 };
}

export function packToSummary(pack: StickerPack): StickerPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    publisher: pack.publisher,
    stickerCount: pack.stickers.length,
    trayFileName: pack.trayImage?.fileName ?? null,
    updatedAt: pack.updatedAt,
    imageDataVersion: pack.imageDataVersion,
  };
}

export function stickerFileNameForIndex(index: number): string {
  return `sticker_${String(index + 1).padStart(2, '0')}${STICKER_FILE_EXTENSION}`;
}


export function nextStickerFileName(pack: StickerPack): string {
  const used = new Set(pack.stickers.map((sticker) => sticker.fileName));
  for (let index = 0; index < WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK; index += 1) {
    const candidate = stickerFileNameForIndex(index);
    if (!used.has(candidate)) return candidate;
  }
  return `sticker_${createId('x').slice(2, 8)}${STICKER_FILE_EXTENSION}`;
}

export interface PackCapacity {
  allowed: boolean;
  code: AppErrorCode | null;
  reason: string | null;
  remaining: number;
}


export function packCapacity(pack: StickerPack): PackCapacity {
  const total = pack.stickers.length;
  const remaining = WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK - total;
  if (remaining <= 0) {
    return {
      allowed: false,
      code: 'PACK_TOO_MANY_STICKERS',
      reason: `Um pacote do WhatsApp aceita no máximo ${WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK} figurinhas.`,
      remaining: 0,
    };
  }
  return { allowed: true, code: null, reason: null, remaining };
}

export function hasMinimumStickers(pack: StickerPack): boolean {
  return pack.stickers.length >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
}

export function remainingStickersToMinimum(pack: StickerPack): number {
  return Math.max(0, WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK - pack.stickers.length);
}

export function canCreateAnotherPack(existingPackCount: number): boolean {
  return existingPackCount < WHATSAPP_LIMITS.MAX_PACKS_PER_APP;
}


export function reindexStickerFileNames(stickers: readonly StickerRecord[]): StickerRecord[] {
  return stickers.map((sticker, index) => ({ ...sticker, fileName: stickerFileNameForIndex(index) }));
}
