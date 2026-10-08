import { describe, expect, it } from 'vitest';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { STICKER_AUTHOR, type StickerPack, type StickerRecord } from '@/domain/stickerPack';
import {
  assertStickerPackExportable,
  validateAccessibilityText,
  validateEmojis,
  validateMetadataText,
  validateStickerFile,
  validateStickerPack,
} from './whatsappRules';
import { AppError } from '@/shared/errors';

function sticker(overrides: Partial<StickerRecord> = {}): StickerRecord {
  return {
    id: 'stk_1',
    fileName: 'sticker_01.webp',
    width: 512,
    height: 512,
    sizeBytes: 20 * 1024,
    emojis: ['✨'],
    accessibilityText: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    projectId: null,
    hasDrawing: false,
    ...overrides,
  };
}

function pack(overrides: Partial<StickerPack> = {}): StickerPack {
  return {
    id: 'shappire_abc12345',
    name: 'Memes',
    publisher: 'Autor',
    stickerType: 'static',
    stickers: [sticker(), sticker({ id: 'stk_2', fileName: 'sticker_02.webp' }), sticker({ id: 'stk_3', fileName: 'sticker_03.webp' })],
    trayImage: { fileName: 'tray.png', sizeBytes: 5 * 1024, width: 96, height: 96 },
    imageDataVersion: 1,
    contentHash: 'hash',
    avoidCache: true,
    links: {
      playStore: '',
      appStore: '',
      publisherEmail: '',
      publisherWebsite: '',
      privacyPolicy: '',
      licenseAgreement: '',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateMetadataText', () => {
  it('aceita identificador válido e recusa vazio', () => {
    expect(validateMetadataText('shappire_abc', 'identifier')).toHaveLength(0);
    expect(validateMetadataText('', 'identifier')[0]?.code).toBe('METADATA_EMPTY');
  });

  it('recusa acentos e caracteres inválidos', () => {
    const issues = validateMetadataText('Pacote do João!', 'name');
    expect(issues.map((issue) => issue.code)).toContain('METADATA_INVALID_CHARS');
  });

  it('recusa ".." e textos acima de 128 caracteres', () => {
    expect(validateMetadataText('a..b', 'name')[0]?.code).toBe('METADATA_INVALID_SEQUENCE');
    const long = 'a'.repeat(WHATSAPP_LIMITS.MAX_METADATA_LENGTH + 1);
    expect(validateMetadataText(long, 'name').map((issue) => issue.code)).toContain(
      'METADATA_TOO_LONG',
    );
  });
});

describe('validateStickerFile', () => {
  it('aceita WebP 512x512 abaixo de 100 KB', () => {
    expect(
      validateStickerFile({ fileName: 'a.webp', sizeBytes: 1000, width: 512, height: 512 }),
    ).toHaveLength(0);
  });

  it('recusa formato diferente de WebP', () => {
    const issues = validateStickerFile({ fileName: 'a.png', sizeBytes: 1000, width: 512, height: 512 });
    expect(issues[0]?.code).toBe('STICKER_NOT_WEBP');
  });

  it('recusa dimensões diferentes de 512x512', () => {
    const issues = validateStickerFile({ fileName: 'a.webp', sizeBytes: 1000, width: 256, height: 256 });
    expect(issues[0]?.code).toBe('STICKER_INVALID_DIMENSIONS');
  });

  it('recusa arquivos acima de 100 KB e avisa quando está próximo', () => {
    const tooLarge = validateStickerFile({
      fileName: 'a.webp',
      sizeBytes: WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES + 1,
      width: 512,
      height: 512,
    });
    expect(tooLarge[0]?.code).toBe('STICKER_TOO_LARGE');

    const near = validateStickerFile({
      fileName: 'a.webp',
      sizeBytes: Math.round(WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES * 0.85),
      width: 512,
      height: 512,
    });
    expect(near[0]?.code).toBe('STICKER_NEAR_LIMIT');
    expect(near[0]?.level).toBe('warning');
  });
});

describe('validateEmojis e validateAccessibilityText', () => {
  it('exige ao menos 1 emoji e no máximo 3', () => {
    expect(validateEmojis([])[0]?.code).toBe('EMOJI_REQUIRED');
    expect(validateEmojis(['😀', '😀', '😀', '😀'])[0]?.code).toBe('EMOJI_TOO_MANY');
    expect(validateEmojis(['😀'])).toHaveLength(0);
  });

  it('avisa (sem erro) quando não há texto de acessibilidade', () => {
    const issues = validateAccessibilityText('');
    expect(issues[0]?.level).toBe('warning');
    expect(issues[0]?.code).toBe('A11Y_MISSING');
  });

  it('recusa texto de acessibilidade longo', () => {
    const long = 'x'.repeat(WHATSAPP_LIMITS.MAX_ACCESSIBILITY_TEXT_LENGTH + 1);
    expect(validateAccessibilityText(long)[0]?.code).toBe('A11Y_TOO_LONG');
  });
});

describe('validateStickerPack', () => {
  it('aceita a autoria fixa no campo publisher (fora do padrão de texto do usuário)', () => {
    const result = validateStickerPack(pack({ publisher: STICKER_AUTHOR }));
    expect(result.errors.map((issue) => issue.code)).not.toContain('METADATA_INVALID_CHARS');
    expect(result.valid).toBe(true);
  });

  it('considera válido um pacote com 3 figurinhas e ícone', () => {
    const result = validateStickerPack(pack());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('recusa pacote com menos de 3 figurinhas', () => {
    const result = validateStickerPack(pack({ stickers: [sticker()] }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain('PACK_TOO_FEW_STICKERS');
  });

  it('recusa pacote sem ícone da bandeja', () => {
    const result = validateStickerPack(pack({ trayImage: null }));
    expect(result.errors.map((issue) => issue.code)).toContain('TRAY_MISSING');
  });

  it('recusa pacote acima de 30 figurinhas', () => {
    const many = Array.from({ length: WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK + 1 }, (_, index) =>
      sticker({ id: `stk_${index}`, fileName: `sticker_${index}.webp` }),
    );
    const result = validateStickerPack(pack({ stickers: many }));
    expect(result.errors.map((issue) => issue.code)).toContain('PACK_TOO_MANY_STICKERS');
  });

  it('valida pacotes animados com suporte a figurinhas animadas', () => {
    const animatedStickers = [
      sticker({ id: 'stk_1', fileName: 'sticker_01.webp', isAnimated: true }),
      sticker({ id: 'stk_2', fileName: 'sticker_02.webp', isAnimated: true }),
      sticker({ id: 'stk_3', fileName: 'sticker_03.webp', isAnimated: true }),
    ];
    const result = validateStickerPack(pack({ stickerType: 'animated', stickers: animatedStickers }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('recusa pacote com mistura de figurinhas estáticas e animadas', () => {
    const mixedStickers = [
      sticker({ id: 'stk_1', fileName: 'sticker_01.webp', isAnimated: false }),
      sticker({ id: 'stk_2', fileName: 'sticker_02.webp', isAnimated: true }),
      sticker({ id: 'stk_3', fileName: 'sticker_03.webp', isAnimated: false }),
    ];
    const result = validateStickerPack(pack({ stickers: mixedStickers }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('PACK_MIXED_TYPES');
  });

  it('recusa pacote estático com figurinhas animadas', () => {
    const allAnimated = [
      sticker({ id: 'stk_1', fileName: 'sticker_01.webp', isAnimated: true }),
      sticker({ id: 'stk_2', fileName: 'sticker_02.webp', isAnimated: true }),
      sticker({ id: 'stk_3', fileName: 'sticker_03.webp', isAnimated: true }),
    ];
    const result = validateStickerPack(pack({ stickerType: 'static', stickers: allAnimated }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('PACK_TYPE_MISMATCH');
  });

  it('usa o tamanho real do arquivo quando informado', () => {
    const files = new Map([
      [
        'sticker_01.webp',
        {
          fileName: 'sticker_01.webp',
          sizeBytes: WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES + 10,
          width: 512,
          height: 512,
        },
      ],
    ]);
    const result = validateStickerPack(pack(), { files });
    expect(result.errors.map((issue) => issue.code)).toContain('STICKER_TOO_LARGE');
  });
});

describe('assertStickerPackExportable', () => {
  it('não lança para pacote válido', () => {
    expect(() => assertStickerPackExportable(pack())).not.toThrow();
  });

  it('lança AppError com o primeiro erro encontrado', () => {
    try {
      assertStickerPackExportable(pack({ stickers: [] }));
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(AppError.is(error)).toBe(true);
      if (AppError.is(error)) {
        expect(error.code).toBe('PACK_TOO_FEW_STICKERS');
      }
    }
  });
});
