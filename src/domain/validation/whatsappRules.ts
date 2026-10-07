import { WHATSAPP_LIMITS, WHATSAPP_METADATA_PATTERN } from '@/config/whatsapp';
import { AppError } from '@/shared/errors';
import type { AppErrorCode } from '@/shared/errors';
import type { StickerPack, StickerRecord, TrayImageRecord } from '@/domain/stickerPack';


export type ValidationLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}


export interface StickerFileInfo {
  fileName: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export function errorIssue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { level: 'error', code, message } : { level: 'error', code, message, field };
}

export function warningIssue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { level: 'warning', code, message } : { level: 'warning', code, message, field };
}

export function toValidationResult(issues: readonly ValidationIssue[]): ValidationResult {
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  return { valid: errors.length === 0, issues: [...issues], errors, warnings };
}

export function formatIssues(issues: readonly ValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.level === 'error' ? '•' : '·'} ${issue.message}`);
}

const FIELD_LABELS: Record<string, string> = {
  identifier: 'identificador',
  name: 'nome',
  publisher: 'autor',
  tray: 'ícone do pacote',
  stickers: 'figurinhas',
  emojis: 'emojis',
  accessibilityText: 'texto de acessibilidade',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}


export function validatePublisherText(value: string): ValidationIssue[] {
  const trimmed = value.trim();
  if (trimmed === '') {
    return [errorIssue('METADATA_EMPTY', 'Preencha o autor do pacote.', 'publisher')];
  }
  if (trimmed.length > WHATSAPP_LIMITS.MAX_METADATA_LENGTH) {
    return [
      errorIssue(
        'METADATA_TOO_LONG',
        `O autor deve ter no máximo ${WHATSAPP_LIMITS.MAX_METADATA_LENGTH} caracteres.`,
        'publisher',
      ),
    ];
  }
  return [];
}

export function validateMetadataText(
  value: string,
  field: 'identifier' | 'name' | 'publisher',
  options: { required?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const label = fieldLabel(field);
  const trimmed = value.trim();
  if (trimmed === '') {
    if (options.required !== false) {
      issues.push(errorIssue('METADATA_EMPTY', `Preencha o ${label} do pacote.`, field));
    }
    return issues;
  }
  if (trimmed.length > WHATSAPP_LIMITS.MAX_METADATA_LENGTH) {
    issues.push(
      errorIssue(
        'METADATA_TOO_LONG',
        `O ${label} deve ter no máximo ${WHATSAPP_LIMITS.MAX_METADATA_LENGTH} caracteres.`,
        field,
      ),
    );
  }
  if (!WHATSAPP_METADATA_PATTERN.test(trimmed)) {
    issues.push(
      errorIssue(
        'METADATA_INVALID_CHARS',
        `O ${label} aceita apenas letras, números, espaço e os caracteres _ - . , '`,
        field,
      ),
    );
  }
  if (trimmed.includes('..')) {
    issues.push(errorIssue('METADATA_INVALID_SEQUENCE', `O ${label} não pode conter ".."`, field));
  }
  return issues;
}

export function validateStickerFile(
  file: StickerFileInfo,
  options: { isAnimated?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const maxBytes = options.isAnimated
    ? WHATSAPP_LIMITS.ANIMATED_STICKER_MAX_BYTES
    : WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES;
  const maxKb = Math.round(maxBytes / 1024);

  if (!file.fileName.toLowerCase().endsWith('.webp')) {
    issues.push(
      errorIssue('STICKER_NOT_WEBP', `A figurinha ${file.fileName} precisa estar no formato WebP.`, 'stickers'),
    );
  }
  if (
    file.width !== WHATSAPP_LIMITS.STICKER_DIMENSION ||
    file.height !== WHATSAPP_LIMITS.STICKER_DIMENSION
  ) {
    issues.push(
      errorIssue(
        'STICKER_INVALID_DIMENSIONS',
        `A figurinha ${file.fileName} deve ter exatamente ${WHATSAPP_LIMITS.STICKER_DIMENSION} x ${WHATSAPP_LIMITS.STICKER_DIMENSION} pixels (atual: ${file.width} x ${file.height}).`,
        'stickers',
      ),
    );
  }
  if (file.sizeBytes > maxBytes) {
    issues.push(
      errorIssue(
        'STICKER_TOO_LARGE',
        `A figurinha ${file.fileName} ficou com ${Math.ceil(file.sizeBytes / 1024)} KB e o limite ${options.isAnimated ? 'para animadas' : ''} é ${maxKb} KB.`,
        'stickers',
      ),
    );
  } else if (file.sizeBytes >= maxBytes * 0.85) {
    issues.push(
      warningIssue(
        'STICKER_NEAR_LIMIT',
        `A figurinha ${file.fileName} está próxima do limite de ${maxKb} KB (${Math.ceil(file.sizeBytes / 1024)} KB).`,
        'stickers',
      ),
    );
  }
  return issues;
}

export function validateEmojis(emojis: readonly string[]): ValidationIssue[] {
  const clean = emojis.map((emoji) => emoji.trim()).filter((emoji) => emoji !== '');
  if (clean.length < WHATSAPP_LIMITS.MIN_EMOJIS_PER_STICKER) {
    return [errorIssue('EMOJI_REQUIRED', 'Cada figurinha precisa de pelo menos 1 emoji.', 'emojis')];
  }
  if (clean.length > WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER) {
    return [
      errorIssue(
        'EMOJI_TOO_MANY',
        `Use no máximo ${WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER} emojis por figurinha.`,
        'emojis',
      ),
    ];
  }
  return [];
}

export function validateAccessibilityText(text: string): ValidationIssue[] {
  const trimmed = text.trim();
  const issues: ValidationIssue[] = [];
  if (trimmed !== '' && trimmed.length > WHATSAPP_LIMITS.MAX_ACCESSIBILITY_TEXT_LENGTH) {
    issues.push(
      errorIssue(
        'A11Y_TOO_LONG',
        `O texto de acessibilidade deve ter no máximo ${WHATSAPP_LIMITS.MAX_ACCESSIBILITY_TEXT_LENGTH} caracteres.`,
        'accessibilityText',
      ),
    );
  }
  if (trimmed === '') {
    issues.push(
      warningIssue(
        'A11Y_MISSING',
        'Sem texto de acessibilidade a figurinha fica sem descrição para leitores de tela.',
        'accessibilityText',
      ),
    );
  }
  return issues;
}

export interface ValidatePackOptions {
  
  files?: ReadonlyMap<string, StickerFileInfo>;
  
  trayFileExists?: boolean;
}

export function validateStickerRecord(
  sticker: StickerRecord,
  fileInfo?: StickerFileInfo,
  options: { isAnimatedPack?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const info: StickerFileInfo =
    fileInfo ??
    ({
      fileName: sticker.fileName,
      sizeBytes: sticker.sizeBytes,
      width: sticker.width,
      height: sticker.height,
    } satisfies StickerFileInfo);
  issues.push(
    ...validateStickerFile(info, {
      isAnimated: sticker.isAnimated || options.isAnimatedPack,
    }),
  );
  issues.push(...validateEmojis(sticker.emojis));
  issues.push(...validateAccessibilityText(sticker.accessibilityText));
  return issues;
}


export function validateStickerPack(
  pack: StickerPack,
  options: ValidatePackOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const isAnimatedPack = pack.stickerType === 'animated';

  issues.push(...validateMetadataText(pack.id, 'identifier'));
  issues.push(...validateMetadataText(pack.name, 'name'));
  issues.push(...validatePublisherText(pack.publisher));

  const count = pack.stickers.length;
  if (count < WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK) {
    issues.push(
      errorIssue(
        'PACK_TOO_FEW_STICKERS',
        `Um pacote precisa de pelo menos ${WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK} figurinhas (atual: ${count}).`,
        'stickers',
      ),
    );
  }
  if (count > WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK) {
    issues.push(
      errorIssue(
        'PACK_TOO_MANY_STICKERS',
        `Um pacote aceita no máximo ${WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK} figurinhas (atual: ${count}).`,
        'stickers',
      ),
    );
  }

  const hasAnimatedStickers = pack.stickers.some((s) => Boolean(s.isAnimated));
  const hasStaticStickers = pack.stickers.some((s) => !s.isAnimated);

  if (hasAnimatedStickers && hasStaticStickers) {
    issues.push(
      errorIssue(
        'PACK_MIXED_TYPES',
        'O WhatsApp não permite misturar figurinhas estáticas e animadas no mesmo pacote. Remova as figurinhas conflitantes para enviar.',
        'stickers',
      ),
    );
  } else if (isAnimatedPack && hasStaticStickers) {
    issues.push(
      errorIssue(
        'PACK_TYPE_MISMATCH',
        'Este pacote está configurado como Animado, mas contém figurinhas estáticas.',
        'stickers',
      ),
    );
  } else if (!isAnimatedPack && hasAnimatedStickers) {
    issues.push(
      errorIssue(
        'PACK_TYPE_MISMATCH',
        'Este pacote está configurado como Estático, mas contém figurinhas animadas.',
        'stickers',
      ),
    );
  }

  for (const sticker of pack.stickers) {
    issues.push(
      ...validateStickerRecord(sticker, options.files?.get(sticker.fileName), { isAnimatedPack }),
    );
  }

  issues.push(...validateTrayImageFile(pack.trayImage));
  if (pack.trayImage && options.trayFileExists === false) {
    issues.push(errorIssue('TRAY_FILE_MISSING', 'O arquivo do ícone do pacote não foi encontrado.', 'tray'));
  }

  return toValidationResult(issues);
}


export function assertStickerPackExportable(pack: StickerPack, options: ValidatePackOptions = {}): void {
  const result = validateStickerPack(pack, options);
  if (result.valid) return;
  const first = result.errors[0];
  const code = (first?.code ?? 'PACK_INVALID') as AppErrorCode;
  throw new AppError(code, first?.message ?? 'Este pacote ainda não atende aos requisitos do WhatsApp.', {
    details: { issues: result.errors.map((issue) => issue.message) },
  });
}

export function validateTrayImageFile(tray: TrayImageRecord | null): ValidationIssue[] {
  if (!tray) {
    return [errorIssue('TRAY_MISSING', 'Escolha a imagem de ícone do pacote (bandeja do WhatsApp).', 'tray')];
  }
  const issues: ValidationIssue[] = [];
  const min = WHATSAPP_LIMITS.TRAY_IMAGE_MIN_DIMENSION;
  const max = WHATSAPP_LIMITS.TRAY_IMAGE_MAX_DIMENSION;
  if (tray.width < min || tray.width > max || tray.height < min || tray.height > max) {
    issues.push(
      errorIssue(
        'TRAY_INVALID_DIMENSIONS',
        `O ícone do pacote deve ter entre ${min}x${min} e ${max}x${max} pixels (recomendado 96x96).`,
        'tray',
      ),
    );
  }
  if (tray.width !== tray.height) {
    issues.push(warningIssue('TRAY_NOT_SQUARE', 'O ideal é que o ícone do pacote seja quadrado.', 'tray'));
  }
  if (tray.sizeBytes > WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES) {
    issues.push(
      errorIssue(
        'TRAY_TOO_LARGE',
        `O ícone do pacote deve ter no máximo ${WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES / 1024} KB.`,
        'tray',
      ),
    );
  }
  return issues;
}
