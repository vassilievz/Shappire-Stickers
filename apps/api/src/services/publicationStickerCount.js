/**
 * Contagem canônica de figurinhas em publicações.
 * Quando `stickers` está materializado no documento, a lista válida é a fonte de verdade.
 * Em documentos legados (sem array), usa-se `stickerCount` persistido.
 */

export function isValidPublicationStickerEntry(sticker) {
  if (!sticker || typeof sticker !== 'object') return false;
  const id = String(sticker.id ?? '').trim();
  const fileId = String(sticker.fileId ?? '').trim();
  return Boolean(id && fileId);
}

/**
 * Conta figurinhas válidas, ignorando entradas incompletas e IDs duplicados (primeira ocorrência vence).
 * @param {unknown} stickers
 * @returns {number}
 */
export function countValidPublicationStickers(stickers) {
  if (!Array.isArray(stickers)) return 0;
  const seen = new Set();
  let count = 0;
  for (const entry of stickers) {
    if (!isValidPublicationStickerEntry(entry)) continue;
    const id = String(entry.id).trim();
    if (seen.has(id)) continue;
    seen.add(id);
    count += 1;
  }
  return count;
}

/**
 * Contagem exposta em DTOs e listagens.
 * @param {{ stickerCount?: number; stickers?: unknown }} doc
 */
export function effectiveStickerCount(doc) {
  if (Array.isArray(doc?.stickers)) {
    return countValidPublicationStickers(doc.stickers);
  }
  const stored = doc?.stickerCount;
  return typeof stored === 'number' && Number.isFinite(stored) ? Math.max(0, Math.floor(stored)) : 0;
}

/**
 * Valor a persistir em `stickerCount` após upload/publicação.
 */
export function stickerCountForPersistence(doc) {
  if (Array.isArray(doc?.stickers)) {
    return countValidPublicationStickers(doc.stickers);
  }
  return effectiveStickerCount(doc);
}

/**
 * Reconciliação: só ajusta quando o array `stickers` existe no documento.
 * @returns {number | null} novo valor se deve atualizar; null se legado sem array.
 */
export function reconciledStickerCountForDocument(doc) {
  if (!Array.isArray(doc?.stickers)) return null;
  return countValidPublicationStickers(doc.stickers);
}
