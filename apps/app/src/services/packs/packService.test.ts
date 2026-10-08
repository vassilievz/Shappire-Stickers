import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { STICKER_AUTHOR } from '@/domain/stickerPack';
import type { ExportedStickerArtwork } from '@/services/imaging/exportSticker';
import { createMemoryFileSystemGateway } from '@/services/storage/memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from '@/services/storage/gateway';
import { packStickerPath, whatsappContentsPath } from '@/services/storage/paths';
import { parseContentsDocument } from '@/services/whatsapp/contentsFile';
import {
  addStickerToPack,
  createPack,
  deletePack,
  listPacks,
  removeStickerFromPack,
  renamePack,
  reorderStickers,
  setTrayFromSticker,
  updateStickerMeta,
} from './packService';

vi.mock('@/services/imaging/imageLoader', () => ({
  decodeImageFromDataUrl: vi.fn(() => Promise.reject(new Error('sem canvas nos testes'))),
  loadImageElement: vi.fn(() => Promise.reject(new Error('sem canvas nos testes'))),
}));

function artwork(sizeBytes = 20_000): ExportedStickerArtwork {
  return {
    base64: Buffer.from('fake-webp').toString('base64'),
    sizeBytes,
    width: 512,
    height: 512,
    quality: 0.9,
    mimeType: 'image/webp',
    warnings: [],
  };
}

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('createPack', () => {
  it('cria, persiste e sincroniza o contents.json', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    expect(pack.id).toMatch(/^shappire_/);

    const packs = await listPacks();
    expect(packs).toHaveLength(1);

    const raw = await getFileSystemGateway().readTextFile(whatsappContentsPath());
    const document = parseContentsDocument(raw);
    expect(document.sticker_packs[0]?.identifier).toBe(pack.id);
    expect(document.sticker_packs[0]?.name).toBe('Memes');
    expect(document.sticker_packs[0]?.publisher).toBe(STICKER_AUTHOR);
  });

  it('usa a autoria fixa no pacote criado', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    expect(pack.publisher).toBe(STICKER_AUTHOR);
  });

  it('recusa nome vazio', async () => {
    await expect(createPack({ name: '   ' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('respeita o limite de pacotes por aplicativo', async () => {
    for (let index = 0; index < WHATSAPP_LIMITS.MAX_PACKS_PER_APP; index += 1) {
      await createPack({ name: `Pacote ${index}` });
    }
    await expect(createPack({ name: 'Excedente' })).rejects.toMatchObject({
      code: 'PACK_LIMIT_REACHED',
    });
  });
});

describe('renamePack', () => {
  it('atualiza o nome, preserva a autoria fixa e incrementa a versão do conteúdo', async () => {
    const { pack } = await createPack({ name: 'Antigo' });
    const updated = await renamePack(pack.id, { name: 'Novo' });
    expect(updated.name).toBe('Novo');
    expect(updated.publisher).toBe(STICKER_AUTHOR);
    expect(updated.imageDataVersion).toBe(pack.imageDataVersion + 1);
  });

  it('lança NOT_FOUND para pacote inexistente', async () => {
    await expect(renamePack('nao-existe', { name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('addStickerToPack', () => {
  it('grava o arquivo WebP e registra a figurinha', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const { pack: updated, sticker } = await addStickerToPack({
      packId: pack.id,
      artwork: artwork(),
      emojis: ['😀'],
      accessibilityText: 'Pessoa sorrindo',
      projectId: 'prj_1',
      hasDrawing: true,
    });

    expect(updated.stickers).toHaveLength(1);
    expect(sticker.fileName).toBe('sticker_01.webp');
    expect(sticker.emojis).toEqual(['😀']);
    expect(sticker.projectId).toBe('prj_1');
    expect(sticker.hasDrawing).toBe(true);
    expect(await getFileSystemGateway().exists(packStickerPath(pack.id, sticker.fileName))).toBe(true);
  });

  it('usa ✨ como emoji padrão e limita a 3', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const { sticker } = await addStickerToPack({ packId: pack.id, artwork: artwork() });
    expect(sticker.emojis).toEqual(['✨']);

    const { sticker: second } = await addStickerToPack({
      packId: pack.id,
      artwork: artwork(),
      emojis: ['a', 'b', 'c', 'd'],
    });
    expect(second.emojis).toHaveLength(WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER);
  });

  it('bloqueia quando o pacote está cheio', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    for (let index = 0; index < WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK; index += 1) {
      await addStickerToPack({ packId: pack.id, artwork: artwork() });
    }
    await expect(addStickerToPack({ packId: pack.id, artwork: artwork() })).rejects.toMatchObject({
      code: 'PACK_TOO_MANY_STICKERS',
    });
  });

  it('bloqueia figurinha animada em pacote estático existente', async () => {
    const { pack } = await createPack({ name: 'Estático' });
    await addStickerToPack({ packId: pack.id, artwork: artwork(), isAnimated: false });

    await expect(
      addStickerToPack({ packId: pack.id, artwork: artwork(), isAnimated: true }),
    ).rejects.toMatchObject({
      code: 'PACK_MIXED_TYPES',
    });
  });
});

describe('removeStickerFromPack', () => {
  it('remove o registro e apaga o arquivo', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const { sticker } = await addStickerToPack({ packId: pack.id, artwork: artwork() });

    const updated = await removeStickerFromPack(pack.id, sticker.id);
    expect(updated.stickers).toHaveLength(0);
    expect(await getFileSystemGateway().exists(packStickerPath(pack.id, sticker.fileName))).toBe(false);
  });

  it('restaura tipo estático quando a única figurinha animada for removida', async () => {
    const { pack } = await createPack({ name: 'Misto Teste' });
    const s1 = (await addStickerToPack({ packId: pack.id, artwork: artwork(), isAnimated: false })).sticker;
    // Simular pacote que tinha virado 'animated' por conta de um GIF adicionado anteriormente
    const { savePacks, loadPacks } = await import('@/services/storage/packRepository');
    const existing = await loadPacks();
    const s2Fake: typeof s1 = {
      ...s1,
      id: 'stk_fake_gif',
      fileName: 'sticker_02.webp',
      isAnimated: true,
    };
    const mixedPack = {
      ...existing[0]!,
      stickerType: 'animated' as const,
      stickers: [existing[0]!.stickers[0]!, s2Fake],
    };
    await savePacks([mixedPack]);

    const updated = await removeStickerFromPack(pack.id, 'stk_fake_gif');
    expect(updated.stickerType).toBe('static');
  });
});

describe('reorderStickers', () => {
  it('reordena conforme a lista informada, mantendo itens ausentes no fim', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const first = (await addStickerToPack({ packId: pack.id, artwork: artwork() })).sticker;
    const second = (await addStickerToPack({ packId: pack.id, artwork: artwork() })).sticker;

    const updated = await reorderStickers(pack.id, [second.id]);
    expect(updated.stickers.map((item) => item.id)).toEqual([second.id, first.id]);
  });
});

describe('updateStickerMeta', () => {
  it('atualiza emojis e texto de acessibilidade', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const { sticker } = await addStickerToPack({ packId: pack.id, artwork: artwork() });

    const updated = await updateStickerMeta(pack.id, sticker.id, {
      emojis: ['🎉', '🥳'],
      accessibilityText: 'Festa',
    });
    expect(updated.stickers[0]).toMatchObject({
      emojis: ['🎉', '🥳'],
      accessibilityText: 'Festa',
    });
  });
});

describe('setTrayFromSticker', () => {
  it('propaga erro claro quando o ícone não pode ser gerado', async () => {
    const { pack } = await createPack({ name: 'Memes' });
    const { sticker } = await addStickerToPack({ packId: pack.id, artwork: artwork() });
    await expect(setTrayFromSticker(pack.id, sticker.id)).rejects.toMatchObject({
      code: 'IMAGE_ENCODE_FAILED',
    });
  });
});

describe('deletePack', () => {
  it('remove o pacote, seus arquivos e o contents.json', async () => {
    const gateway = getFileSystemGateway();
    const { pack } = await createPack({ name: 'Memes' });
    const { sticker } = await addStickerToPack({ packId: pack.id, artwork: artwork() });

    await deletePack(pack.id);
    expect(await listPacks()).toHaveLength(0);
    expect(await gateway.exists(packStickerPath(pack.id, sticker.fileName))).toBe(false);

    const document = parseContentsDocument(await gateway.readTextFile(whatsappContentsPath()));
    expect(document.sticker_packs).toHaveLength(0);
  });
});
