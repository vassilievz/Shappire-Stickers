import type { PublicationDetail } from '@shappire/contracts';
import { createPack, addExistingImageToPack } from '@/services/packs/packService';
import { collectPublication } from '@/services/api/socialApi';
import { savePackSocial } from '@/services/storage/packSocialRepository';
async function downloadBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Falha ao baixar figurinha.');
  return response.blob();
}

export interface ImportResult {
  packId: string;
  publicationId: string;
}

/**
 * Registra a coleção no backend e cria um pacote local importado com referência à publicação original.
 */
export async function importPublicationToLibrary(detail: PublicationDetail): Promise<ImportResult> {
  await collectPublication(detail.id);

  const { pack } = await createPack({
    name: detail.title,
    stickerType: detail.stickers.some((s) => s.isAnimated) ? 'animated' : 'static',
  });

  await savePackSocial(pack.id, {
    publicationId: detail.id,
    visibility: detail.visibility,
    lastSyncedAt: new Date().toISOString(),
    sourceAuthorName: detail.author?.displayName ?? '',
    sourceAuthorUsername: detail.author?.username ?? null,
    importedAt: new Date().toISOString(),
  });

  for (const sticker of detail.stickers) {
    const blob = await downloadBlob(sticker.url);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler figurinha.'));
      reader.readAsDataURL(blob);
    });
    await addExistingImageToPack({
      packId: pack.id,
      dataUrl,
      emojis: sticker.emojis,
      accessibilityText: sticker.accessibilityText,
    });
  }

  return { packId: pack.id, publicationId: detail.id };
}

export function buildImportedPackPublisher(authorName: string, publicationId: string): string {
  return `${authorName} · ref:${publicationId.slice(0, 8)}`;
}
