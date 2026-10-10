import type { StickerPack } from '@/domain/stickerPack';
import { readStickerDataUrl } from '@/services/packs/packService';
import {
  publishPublication,
  unpublishPublication,
  uploadPublicationSticker,
  upsertPublicationDraft,
} from '@/services/api/socialApi';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';

const UPLOAD_CONCURRENCY = 3;

export type PublishProgressPhase = 'draft' | 'upload' | 'publish' | 'done';

export interface PublishProgress {
  phase: PublishProgressPhase;
  completed?: number;
  total?: number;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/webp';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  }

  const pool = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: pool }, () => runWorker()));
  return results;
}

function logPublishTiming(phase: string, startedAt: number) {
  if (!import.meta.env.DEV) return;
  const ms = Math.round(performance.now() - startedAt);
  console.warn('[publication]', { phase, ms });
}

export interface PublishPackInput {
  pack: StickerPack;
  description: string;
  isAdultContent: boolean;
  makePublic: boolean;
  publicationId?: string | null;
  onProgress?: (progress: PublishProgress) => void;
}

export async function syncPackToPublication(input: PublishPackInput) {
  const flowStart = performance.now();
  input.onProgress?.({ phase: 'draft' });

  const draftStart = performance.now();
  const draft = await upsertPublicationDraft({
    localPackId: input.pack.id,
    title: input.pack.name,
    description: input.description,
    isAdultContent: input.isAdultContent,
    visibility: input.makePublic ? PUBLICATION_VISIBILITY.public : PUBLICATION_VISIBILITY.private,
    publicationId: input.publicationId ?? undefined,
  });
  logPublishTiming('draft', draftStart);

  const stickers = input.pack.stickers;
  const total = stickers.length;
  let completed = 0;
  input.onProgress?.({ phase: 'upload', completed: 0, total });

  const uploadStart = performance.now();
  await runWithConcurrency(stickers, UPLOAD_CONCURRENCY, async (sticker) => {
    const dataUrl = await readStickerDataUrl(input.pack.id, sticker.fileName);
    const blob = dataUrlToBlob(dataUrl);
    await uploadPublicationSticker(draft.id, sticker.id, blob, {
      fileName: sticker.fileName,
      emojis: sticker.emojis,
      accessibilityText: sticker.accessibilityText,
      width: sticker.width,
      height: sticker.height,
      isAnimated: Boolean(sticker.isAnimated),
      durationMs: sticker.durationMs ?? 0,
    });
    completed += 1;
    input.onProgress?.({ phase: 'upload', completed, total });
  });
  logPublishTiming('upload', uploadStart);

  if (input.makePublic) {
    input.onProgress?.({ phase: 'publish' });
    const publishStart = performance.now();
    const published = await publishPublication(draft.id);
    logPublishTiming('publish', publishStart);
    logPublishTiming('total', flowStart);
    input.onProgress?.({ phase: 'done' });
    return published;
  }

  logPublishTiming('total', flowStart);
  input.onProgress?.({ phase: 'done' });
  return draft;
}

export async function makePublicationPrivate(publicationId: string) {
  return unpublishPublication(publicationId);
}
