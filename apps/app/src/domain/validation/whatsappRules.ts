import { WHATSAPP_LIMITS, WHATSAPP_METADATA_PATTERN } from '@/config/whatsapp';
import { t } from '@/i18n';
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

export function fieldLabel(field: string): string {
  return t(`validation.fields.${field}`);
}


export function validatePublisherText(value: string): ValidationIssue[] {
  const trimmed = value.trim();
  if (trimmed === '') {
    return [errorIssue('METADATA_EMPTY', t('validation.metadataEmptyPublisher'), 'publisher')];
  }
  if (trimmed.length > WHATSAPP_LIMITS.MAX_METADATA_LENGTH) {
    return [
      errorIssue(
        'METADATA_TOO_LONG',
        t('validation.metadataTooLong', {
          field: fieldLabel('publisher'),
          max: WHATSAPP_LIMITS.MAX_METADATA_LENGTH,
        }),
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
      issues.push(errorIssue('METADATA_EMPTY', t('validation.metadataEmpty', { field: label }), field));
    }
    return issues;
  }
  if (trimmed.length > WHATSAPP_LIMITS.MAX_METADATA_LENGTH) {
    issues.push(
      errorIssue(
        'METADATA_TOO_LONG',
        t('validation.metadataTooLong', {
          field: label,
          max: WHATSAPP_LIMITS.MAX_METADATA_LENGTH,
        }),
        field,
      ),
    );
  }
  if (!WHATSAPP_METADATA_PATTERN.test(trimmed)) {
    issues.push(
      errorIssue(
        'METADATA_INVALID_CHARS',
        t('validation.metadataInvalidChars', { field: label }),
        field,
      ),
    );
  }
  if (trimmed.includes('..')) {
    issues.push(
      errorIssue(
        'METADATA_INVALID_SEQUENCE',
        t('validation.metadataInvalidSequence', { field: label }),
        field,
      ),
    );
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
  const sizeKb = Math.ceil(file.sizeBytes / 1024);

  if (!file.fileName.toLowerCase().endsWith('.webp')) {
    issues.push(
      errorIssue(
        'STICKER_NOT_WEBP',
        t('validation.stickerNotWebp', { file: file.fileName }),
        'stickers',
      ),
    );
  }
  if (
    file.width !== WHATSAPP_LIMITS.STICKER_DIMENSION ||
    file.height !== WHATSAPP_LIMITS.STICKER_DIMENSION
  ) {
    issues.push(
      errorIssue(
        'STICKER_INVALID_DIMENSIONS',
        t('validation.stickerInvalidDimensions', {
          file: file.fileName,
          dimension: WHATSAPP_LIMITS.STICKER_DIMENSION,
          width: file.width,
          height: file.height,
        }),
        'stickers',
      ),
    );
  }
  if (file.sizeBytes > maxBytes) {
    issues.push(
      errorIssue(
        'STICKER_TOO_LARGE',
        options.isAnimated
          ? t('validation.stickerTooLargeAnimated', {
              file: file.fileName,
              size: sizeKb,
              max: maxKb,
            })
          : t('validation.stickerTooLarge', { file: file.fileName, size: sizeKb, max: maxKb }),
        'stickers',
      ),
    );
  } else if (file.sizeBytes >= maxBytes * 0.85) {
    issues.push(
      warningIssue(
        'STICKER_NEAR_LIMIT',
        t('validation.stickerNearLimit', { file: file.fileName, size: sizeKb, max: maxKb }),
        'stickers',
      ),
    );
  }
  return issues;
}

export function validateEmojis(emojis: readonly string[]): ValidationIssue[] {
  const clean = emojis.map((emoji) => emoji.trim()).filter((emoji) => emoji !== '');
  if (clean.length < WHATSAPP_LIMITS.MIN_EMOJIS_PER_STICKER) {
    return [errorIssue('EMOJI_REQUIRED', t('validation.emojiRequired'), 'emojis')];
  }
  if (clean.length > WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER) {
    return [
      errorIssue(
        'EMOJI_TOO_MANY',
        t('validation.emojiTooMany', { max: WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER }),
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
        t('validation.a11yTooLong', { max: WHATSAPP_LIMITS.MAX_ACCESSIBILITY_TEXT_LENGTH }),
        'accessibilityText',
      ),
    );
  }
  if (trimmed === '') {
    issues.push(
      warningIssue('A11Y_MISSING', t('validation.a11yMissing'), 'accessibilityText'),
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
        t('validation.packTooFew', { min: WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK, count }),
        'stickers',
      ),
    );
  }
  if (count > WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK) {
    issues.push(
      errorIssue(
        'PACK_TOO_MANY_STICKERS',
        t('validation.packTooMany', { max: WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK, count }),
        'stickers',
      ),
    );
  }

  const hasAnimatedStickers = pack.stickers.some((s) => Boolean(s.isAnimated));
  const hasStaticStickers = pack.stickers.some((s) => !s.isAnimated);

  if (hasAnimatedStickers && hasStaticStickers) {
    issues.push(
      errorIssue('PACK_MIXED_TYPES', t('validation.packMixedTypes'), 'stickers'),
    );
  } else if (isAnimatedPack && hasStaticStickers) {
    issues.push(
      errorIssue('PACK_TYPE_MISMATCH', t('validation.packTypeMismatchAnimated'), 'stickers'),
    );
  } else if (!isAnimatedPack && hasAnimatedStickers) {
    issues.push(
      errorIssue('PACK_TYPE_MISMATCH', t('validation.packTypeMismatchStatic'), 'stickers'),
    );
  }

  for (const sticker of pack.stickers) {
    issues.push(
      ...validateStickerRecord(sticker, options.files?.get(sticker.fileName), { isAnimatedPack }),
    );
  }

  issues.push(...validateTrayImageFile(pack.trayImage));
  if (pack.trayImage && options.trayFileExists === false) {
    issues.push(errorIssue('TRAY_FILE_MISSING', t('validation.trayFileMissing'), 'tray'));
  }

  return toValidationResult(issues);
}


export function assertStickerPackExportable(pack: StickerPack, options: ValidatePackOptions = {}): void {
  const result = validateStickerPack(pack, options);
  if (result.valid) return;
  const first = result.errors[0];
  const code = (first?.code ?? 'PACK_INVALID') as AppErrorCode;
  throw new AppError(code, first?.message ?? t('validation.packInvalid'), {
    details: { issues: result.errors.map((issue) => issue.message) },
  });
}

export function validateTrayImageFile(tray: TrayImageRecord | null): ValidationIssue[] {
  if (!tray) {
    return [errorIssue('TRAY_MISSING', t('validation.trayMissing'), 'tray')];
  }
  const issues: ValidationIssue[] = [];
  const min = WHATSAPP_LIMITS.TRAY_IMAGE_MIN_DIMENSION;
  const max = WHATSAPP_LIMITS.TRAY_IMAGE_MAX_DIMENSION;
  if (tray.width < min || tray.width > max || tray.height < min || tray.height > max) {
    issues.push(
      errorIssue('TRAY_INVALID_DIMENSIONS', t('validation.trayInvalidDimensions', { min, max }), 'tray'),
    );
  }
  if (tray.width !== tray.height) {
    issues.push(warningIssue('TRAY_NOT_SQUARE', t('validation.trayNotSquare'), 'tray'));
  }
  if (tray.sizeBytes > WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES) {
    issues.push(
      errorIssue(
        'TRAY_TOO_LARGE',
        t('validation.trayTooLarge', { max: WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES / 1024 }),
        'tray',
      ),
    );
  }
  return issues;
}
