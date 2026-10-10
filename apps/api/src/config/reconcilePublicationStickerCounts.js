import { Publication } from '../models/Publication.js';
import { reconciledStickerCountForDocument } from '../services/publicationStickerCount.js';

/**
 * Corrige `stickerCount` quando diverge da lista `stickers` materializada.
 * Idempotente: segunda execução não altera documentos já coerentes.
 * Não altera documentos legados sem array `stickers`.
 */
export async function reconcilePublicationStickerCounts() {
  if (process.env.SYNC_PUBLICATION_STICKER_COUNTS === 'false') return { scanned: 0, updated: 0 };

  const cursor = Publication.find({ status: 'active', stickers: { $type: 'array' } })
    .select('stickerCount stickers')
    .cursor();

  let scanned = 0;
  let updated = 0;
  for await (const doc of cursor) {
    scanned += 1;
    const expected = reconciledStickerCountForDocument(doc);
    if (expected === null) continue;
    if (doc.stickerCount !== expected) {
      await Publication.updateOne({ _id: doc._id }, { $set: { stickerCount: expected } });
      updated += 1;
    }
  }
  return { scanned, updated };
}
