
export const WHATSAPP_LIMITS = {
  STICKER_DIMENSION: 512,
  STATIC_STICKER_MAX_BYTES: 100 * 1024,
  ANIMATED_STICKER_MAX_BYTES: 500 * 1024,
  TRAY_IMAGE_SIZE: 96,
  TRAY_IMAGE_MIN_DIMENSION: 24,
  TRAY_IMAGE_MAX_DIMENSION: 512,
  TRAY_IMAGE_MAX_BYTES: 50 * 1024,
  MIN_STICKERS_PER_PACK: 3,
  MAX_STICKERS_PER_PACK: 30,
  MAX_PACKS_PER_APP: 10,
  MIN_EMOJIS_PER_STICKER: 1,
  MAX_EMOJIS_PER_STICKER: 3,
  MAX_ACCESSIBILITY_TEXT_LENGTH: 125,
  MAX_METADATA_LENGTH: 128,
  
  RECOMMENDED_STROKE_WIDTH: 8,
  RECOMMENDED_STROKE_COLOR: '#FFFFFF',
} as const;


export const WHATSAPP_METADATA_PATTERN = /^[\w\-.,'\s]+$/;


export const WHATSAPP_CONTENT_TYPES = {
  metadata: 'vnd.android.cursor.dir/vnd.com.whatsapp.sticker.contents',
  metadataItem: 'vnd.android.cursor.item/vnd.com.whatsapp.sticker.contents',
  stickers: 'vnd.android.cursor.dir/vnd.com.whatsapp.sticker.sticker',
  trayIcon: 'image/png',
  stickerAsset: 'image/webp',
} as const;


export const WHATSAPP_INTENT = {
  actionEnableStickerPack: 'com.whatsapp.intent.action.ENABLE_STICKER_PACK',
  extraStickerPackId: 'sticker_pack_id',
  extraStickerPackAuthority: 'sticker_pack_authority',
  extraStickerPackName: 'sticker_pack_name',
  extraValidationResult: 'validation_result',
  consumerPackage: 'com.whatsapp',
  businessPackage: 'com.whatsapp.w4b',
} as const;


export const CONTENT_PROVIDER_AUTHORITY_SUFFIX = '.stickercontentprovider';


export const STICKER_FILE_EXTENSION = '.webp';
export const TRAY_FILE_NAME = 'tray.png';
export const CONTENTS_FILE_NAME = 'contents.json';
