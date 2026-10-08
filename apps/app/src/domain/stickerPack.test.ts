import { describe, expect, it } from 'vitest';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import {
  STICKER_AUTHOR,
  canCreateAnotherPack,
  computePackContentHash,
  createStickerPack,
  sanitizeAccessibilityText,
  hasMinimumStickers,
  nextStickerFileName,
  packCapacity,
  packToSummary,
  reindexStickerFileNames,
  remainingStickersToMinimum,
  stickerFileNameForIndex,
  updateStickerPack,
  type StickerRecord,
} from './stickerPack';

function sticker(index: number, fileName = stickerFileNameForIndex(index)): StickerRecord {
  return {
    id: `stk_${index}`,
    fileName,
    width: 512,
    height: 512,
    sizeBytes: 10_000,
    emojis: ['✨'],
    accessibilityText: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    projectId: null,
    hasDrawing: false,
  };
}

describe('autoria fixa', () => {
  it('mantém a constante exatamente no formato exigido', () => {
    expect(STICKER_AUTHOR).toBe('IG・@vassilievz');
    expect(STICKER_AUTHOR).toHaveLength('IG・@vassilievz'.length);
  });

  it('remove o crédito legado do texto de acessibilidade', () => {
    expect(sanitizeAccessibilityText('Sorriso • Creator: IG @vassilievz')).toBe('Sorriso');
    expect(sanitizeAccessibilityText('Creator: IG @vassilievz')).toBe('');
    expect(sanitizeAccessibilityText('Sorriso')).toBe('Sorriso');
    expect(sanitizeAccessibilityText('')).toBe('');
  });
});

describe('criação de pacote', () => {
  it('gera id válido para o WhatsApp e metadados consistentes', () => {
    const pack = createStickerPack({ name: 'Memes' });
    expect(pack.id).toMatch(/^shappire_[0-9a-f]{8}$/);
    expect(pack.name).toBe('Memes');
    expect(pack.stickerType).toBe('static');
    expect(pack.imageDataVersion).toBe(1);
    expect(pack.contentHash).toBe(computePackContentHash(pack));
  });

  it('aplica a autoria fixa independentemente do nome do pacote', () => {
    const pack = createStickerPack({ name: 'Memes do dia' });
    expect(pack.publisher).toBe(STICKER_AUTHOR);
  });

  it('impede que alterações no pacote modifiquem a autoria fixa', () => {
    const pack = createStickerPack({ name: 'Memes do dia' });
    const updated = updateStickerPack(pack, { name: 'Novo Nome', publisher: 'Outro Autor' } as Partial<typeof pack>);
    expect(updated.name).toBe('Novo Nome');
    expect(updated.publisher).toBe(STICKER_AUTHOR);
  });
});

describe('versão de conteúdo (image_data_version)', () => {
  it('incrementa a versão quando o conteúdo muda', () => {
    const pack = createStickerPack({ name: 'Memes' });
    const withSticker = updateStickerPack(pack, { stickers: [sticker(0)] });
    expect(withSticker.imageDataVersion).toBe(pack.imageDataVersion + 1);
    expect(withSticker.contentHash).not.toBe(pack.contentHash);
  });

  it('não incrementa quando nada relevante muda (apenas updatedAt)', () => {
    const pack = createStickerPack({ name: 'Memes' });
    const again = updateStickerPack(pack, {});
    expect(again.imageDataVersion).toBe(pack.imageDataVersion);
  });
});

describe('nomes de arquivo e reindexação', () => {
  it('usa nomes sequenciais com dois dígitos', () => {
    expect(stickerFileNameForIndex(0)).toBe('sticker_01.webp');
    expect(stickerFileNameForIndex(9)).toBe('sticker_10.webp');
  });

  it('escolhe o próximo nome livre', () => {
    const pack = createStickerPack({ name: 'M' });
    expect(nextStickerFileName(pack)).toBe('sticker_01.webp');
    const filled = { ...pack, stickers: [sticker(0), sticker(1)] };
    expect(nextStickerFileName(filled)).toBe('sticker_03.webp');
  });

  it('reindexa os nomes após remoção', () => {
    const stickers = [sticker(0), sticker(1), sticker(2)];
    const removedMiddle = [stickers[0], stickers[2]].filter(
      (item): item is StickerRecord => item !== undefined,
    );
    expect(reindexStickerFileNames(removedMiddle).map((item) => item.fileName)).toEqual([
      'sticker_01.webp',
      'sticker_02.webp',
    ]);
  });
});

describe('capacidade e limites', () => {
  it('informa quantas figurinhas ainda cabem', () => {
    const pack = createStickerPack({ name: 'M' });
    expect(packCapacity(pack)).toMatchObject({ allowed: true, remaining: 30 });
  });

  it('bloqueia quando o pacote está cheio', () => {
    const stickers = Array.from({ length: WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK }, (_, index) =>
      sticker(index),
    );
    const pack = { ...createStickerPack({ name: 'M' }), stickers };
    const capacity = packCapacity(pack);
    expect(capacity.allowed).toBe(false);
    expect(capacity.code).toBe('PACK_TOO_MANY_STICKERS');
  });

  it('controla o mínimo de figurinhas e o total de pacotes', () => {
    const pack = createStickerPack({ name: 'M' });
    expect(hasMinimumStickers({ ...pack, stickers: [sticker(0), sticker(1)] })).toBe(false);
    expect(remainingStickersToMinimum({ ...pack, stickers: [sticker(0)] })).toBe(2);
    expect(canCreateAnotherPack(WHATSAPP_LIMITS.MAX_PACKS_PER_APP - 1)).toBe(true);
    expect(canCreateAnotherPack(WHATSAPP_LIMITS.MAX_PACKS_PER_APP)).toBe(false);
  });
});

describe('resumo do pacote', () => {
  it('expõe apenas os dados necessários para listagens', () => {
    const pack = createStickerPack({ name: 'Memes' });
    const summary = packToSummary({ ...pack, stickers: [sticker(0)] });
    expect(summary).toMatchObject({
      id: pack.id,
      name: 'Memes',
      publisher: STICKER_AUTHOR,
      stickerCount: 1,
      trayFileName: null,
    });
  });
});
