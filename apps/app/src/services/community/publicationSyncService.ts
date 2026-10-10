import type { StickerPack } from '@/domain/stickerPack';
import { readStickerDataUrl } from '@/services/packs/packService';
import {
  publishPublication,
  unpublishPublication,
  uploadPublicationSticker,
  upsertPublicationDraft,
} from '@/services/api/socialApi';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';

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

export interface PublishPackInput {
  pack: StickerPack;
  description: string;
  isAdultContent: boolean;
  makePublic: boolean;
  publicationId?: string | null;
}

export async function syncPackToPublication(input: PublishPackInput) {
  const draft = await upsertPublicationDraft({
    localPackId: input.pack.id,
    title: input.pack.name,
    description: input.description,
    isAdultContent: input.isAdultContent,
    visibility: input.makePublic ? PUBLICATION_VISIBILITY.public : PUBLICATION_VISIBILITY.private,
    publicationId: input.publicationId ?? undefined,
  });

  for (const sticker of input.pack.stickers) {
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
  }

  if (input.makePublic) {
    return publishPublication(draft.id);
  }
  return draft;
}

export async function makePublicationPrivate(publicationId: string) {
  return unpublishPublication(publicationId);
}
