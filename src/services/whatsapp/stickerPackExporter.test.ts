import { beforeEach, describe, expect, it } from 'vitest';
import { STICKER_AUTHOR, createStickerPack, type StickerPack } from '@/domain/stickerPack';
import { createMemoryFileSystemGateway } from '@/services/storage/memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from '@/services/storage/gateway';
import {
  buildContentsDocument,
  parseContentsDocument,
  serializeContentsDocument,
  toWhatsAppPackEntry,
} from './contentsFile';
import {
  computeWhatsAppStorageBytes,
  listPackFiles,
  readPackFilesInfo,
  trayFileExists,
  writeStickerFile,
  writeTrayFile,
  writeWhatsAppContents,
} from './stickerPackExporter';

function samplePack(): StickerPack {
  return {
    ...createStickerPack({ name: 'Memes' }),
    stickers: [
      {
        id: 'stk_1',
        fileName: 'sticker_01.webp',
        width: 512,
        height: 512,
        sizeBytes: 1234,
        emojis: ['😀'],
        accessibilityText: 'Sorriso',
        createdAt: '2026-01-01T00:00:00.000Z',
        projectId: null,
        hasDrawing: false,
      },
    ],
    trayImage: { fileName: 'tray.png', sizeBytes: 800, width: 96, height: 96 },
  };
}

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('contentsFile', () => {
  it('serializa os campos no formato exigido pelo WhatsApp (snake_case)', () => {
    const pack = samplePack();
    const entry = toWhatsAppPackEntry(pack);
    expect(entry).toMatchObject({
      identifier: pack.id,
      name: 'Memes',
      publisher: STICKER_AUTHOR,
      tray_image_file: 'tray.png',
      animated_sticker_pack: false,
      avoid_cache: true,
    });
    expect(entry.stickers[0]).toEqual({
      image_file: 'sticker_01.webp',
      emojis: ['😀'],
      accessibility_text: 'Sorriso',
    });
  });

  it('remove o crédito legado do texto de acessibilidade (compatibilidade)', () => {
    const pack = samplePack();
    pack.stickers[0]!.accessibilityText = 'Sorriso • Creator: IG @vassilievz';
    const entry = toWhatsAppPackEntry(pack);
    expect(entry.stickers[0]?.accessibility_text).toBe('Sorriso');
  });

  it('força a autoria fixa mesmo quando o pacote guarda outro autor (dados antigos)', () => {
    const pack = { ...samplePack(), publisher: 'Autor antigo' };
    expect(toWhatsAppPackEntry(pack).publisher).toBe(STICKER_AUTHOR);
  });

  it('mantém o nome personalizado do pacote', () => {
    const pack = { ...samplePack(), name: 'Memes favoritos' };
    expect(toWhatsAppPackEntry(pack).name).toBe('Memes favoritos');
  });

  it('faz round-trip de serialização e leitura', () => {
    const document = buildContentsDocument([samplePack()], { playStore: 'https://play' });
    const parsed = parseContentsDocument(serializeContentsDocument(document));
    expect(parsed.android_play_store_link).toBe('https://play');
    expect(parsed.sticker_packs).toHaveLength(1);
    expect(parsed.sticker_packs[0]?.stickers).toHaveLength(1);
  });

  it('descarta pacotes sem identificador ao ler', () => {
    const parsed = parseContentsDocument(JSON.stringify({ sticker_packs: [{ name: 'sem id' }] }));
    expect(parsed.sticker_packs).toHaveLength(0);
  });
});

describe('escrita de arquivos para o WhatsApp', () => {
  it('grava figurinha, ícone e o índice global', async () => {
    const gateway = getFileSystemGateway();
    const pack = samplePack();

    const { path, sizeBytes } = await writeStickerFile(pack.id, {
      fileName: 'sticker_01.webp',
      base64: Buffer.from('conteudo-webp').toString('base64'),
    });
    expect(sizeBytes).toBeGreaterThan(0);
    expect(await gateway.exists(path)).toBe(true);

    await writeTrayFile(pack.id, 'tray.png', Buffer.from('png').toString('base64'));
    expect(await trayFileExists(pack)).toBe(true);

    await writeWhatsAppContents([pack]);
    const parsed = parseContentsDocument(await gateway.readTextFile('sticker_packs/contents.json'));
    expect(parsed.sticker_packs[0]?.identifier).toBe(pack.id);
  });

  it('lê os tamanhos reais das figurinhas para validação', async () => {
    const pack = samplePack();
    await writeStickerFile(pack.id, {
      fileName: 'sticker_01.webp',
      base64: Buffer.from('0123456789').toString('base64'),
    });
    const files = await readPackFilesInfo(pack);
    expect(files.get('sticker_01.webp')?.sizeBytes).toBe(10);
  });

  it('lista arquivos e soma o armazenamento usado', async () => {
    const pack = samplePack();
    await writeStickerFile(pack.id, {
      fileName: 'sticker_01.webp',
      base64: Buffer.from('0123456789').toString('base64'),
    });
    await writeTrayFile(pack.id, 'tray.png', Buffer.from('png').toString('base64'));

    const files = await listPackFiles(pack.id);
    expect(files.map((file) => file.name).sort()).toEqual(['sticker_01.webp', 'tray.png']);
    expect(await computeWhatsAppStorageBytes()).toBe(13);
  });
});
