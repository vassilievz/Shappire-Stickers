import { describe, it, expect } from 'vitest';
import {
  countValidPublicationStickers,
  effectiveStickerCount,
  reconciledStickerCountForDocument,
} from './publicationStickerCount.js';

function sticker(id, fileId = `file-${id}`) {
  return { id, fileId, url: `https://cdn/${id}.png` };
}

describe('publicationStickerCount', () => {
  describe('countValidPublicationStickers', () => {
    it('conta quatro stickers válidos', () => {
      expect(
        countValidPublicationStickers([
          sticker('a'),
          sticker('b'),
          sticker('c'),
          sticker('d'),
        ]),
      ).toBe(4);
    });

    it('ignora entradas sem fileId ou id', () => {
      expect(
        countValidPublicationStickers([
          sticker('a'),
          { id: 'b' },
          { fileId: 'x' },
          sticker('c'),
        ]),
      ).toBe(2);
    });

    it('deduplica por id', () => {
      expect(countValidPublicationStickers([sticker('a'), sticker('a'), sticker('b')])).toBe(2);
    });

    it('array vazio retorna zero', () => {
      expect(countValidPublicationStickers([])).toBe(0);
    });
  });

  describe('effectiveStickerCount', () => {
    it('stickerCount=0 com quatro stickers reais no array usa o array', () => {
      const doc = {
        stickerCount: 0,
        stickers: [sticker('1'), sticker('2'), sticker('3'), sticker('4')],
      };
      expect(effectiveStickerCount(doc)).toBe(4);
    });

    it('stickerCount=1 com quatro stickers reais no array usa o array', () => {
      const doc = {
        stickerCount: 1,
        stickers: [sticker('1'), sticker('2'), sticker('3'), sticker('4')],
      };
      expect(effectiveStickerCount(doc)).toBe(4);
    });

    it('stickerCount=4 com quatro stickers reais permanece 4', () => {
      const doc = {
        stickerCount: 4,
        stickers: [sticker('1'), sticker('2'), sticker('3'), sticker('4')],
      };
      expect(effectiveStickerCount(doc)).toBe(4);
    });

    it('array vazio retorna zero mesmo com stickerCount positivo', () => {
      expect(effectiveStickerCount({ stickerCount: 3, stickers: [] })).toBe(0);
    });

    it('documento legado sem array usa stickerCount persistido', () => {
      expect(effectiveStickerCount({ stickerCount: 4 })).toBe(4);
      expect(effectiveStickerCount({ stickerCount: 0 })).toBe(0);
      expect(effectiveStickerCount({})).toBe(0);
    });

    it('publicação parcialmente concluída: só duas entradas válidas', () => {
      expect(
        effectiveStickerCount({
          stickerCount: 10,
          stickers: [sticker('1'), sticker('2'), { id: '3' }],
        }),
      ).toBe(2);
    });
  });

  describe('reconciledStickerCountForDocument', () => {
    it('retorna null sem array (legado)', () => {
      expect(reconciledStickerCountForDocument({ stickerCount: 5 })).toBeNull();
    });

    it('corrige divergência positiva incorreta', () => {
      expect(
        reconciledStickerCountForDocument({
          stickerCount: 1,
          stickers: [sticker('1'), sticker('2'), sticker('3'), sticker('4')],
        }),
      ).toBe(4);
    });
  });
});
