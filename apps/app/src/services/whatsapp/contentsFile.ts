import { STICKER_AUTHOR, sanitizeAccessibilityText, type StickerPack } from '@/domain/stickerPack';


export interface WhatsAppStickerEntry {
  image_file: string;
  emojis: string[];
  accessibility_text: string;
}

export interface WhatsAppPackEntry {
  identifier: string;
  name: string;
  publisher: string;
  tray_image_file: string;
  image_data_version: string;
  avoid_cache: boolean;
  animated_sticker_pack: boolean;
  publisher_email: string;
  publisher_website: string;
  privacy_policy_website: string;
  license_agreement_website: string;
  stickers: WhatsAppStickerEntry[];
}

export interface WhatsAppContentsDocument {
  android_play_store_link: string;
  ios_app_store_link: string;
  sticker_packs: WhatsAppPackEntry[];
}

export function toWhatsAppStickerEntry(sticker: {
  fileName: string;
  emojis: string[];
  accessibilityText: string;
}): WhatsAppStickerEntry {
  return {
    image_file: sticker.fileName,
    emojis: sticker.emojis,
    accessibility_text: sanitizeAccessibilityText(sticker.accessibilityText),
  };
}

export function toWhatsAppPackEntry(pack: StickerPack): WhatsAppPackEntry {
  return {
    identifier: pack.id,
    name: pack.name,
    publisher: STICKER_AUTHOR,
    tray_image_file: pack.trayImage?.fileName ?? '',
    image_data_version: String(pack.imageDataVersion),
    avoid_cache: pack.avoidCache,
    animated_sticker_pack: pack.stickerType === 'animated',
    publisher_email: pack.links.publisherEmail,
    publisher_website: pack.links.publisherWebsite,
    privacy_policy_website: pack.links.privacyPolicy,
    license_agreement_website: pack.links.licenseAgreement,
    stickers: pack.stickers.map(toWhatsAppStickerEntry),
  };
}

export interface ContentsDocumentLinks {
  playStore?: string;
  appStore?: string;
}

export function buildContentsDocument(
  packs: readonly StickerPack[],
  links: ContentsDocumentLinks = {},
): WhatsAppContentsDocument {
  return {
    android_play_store_link: links.playStore ?? '',
    ios_app_store_link: links.appStore ?? '',
    sticker_packs: packs.map(toWhatsAppPackEntry),
  };
}

export function serializeContentsDocument(document: WhatsAppContentsDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}


export function parseContentsDocument(raw: string): WhatsAppContentsDocument {
  const parsed = JSON.parse(raw) as Partial<WhatsAppContentsDocument>;
  const packs = Array.isArray(parsed.sticker_packs) ? parsed.sticker_packs : [];
  return {
    android_play_store_link: parsed.android_play_store_link ?? '',
    ios_app_store_link: parsed.ios_app_store_link ?? '',
    sticker_packs: packs
      .filter((pack): pack is WhatsAppPackEntry => typeof pack?.identifier === 'string')
      .map((pack) => ({
        ...pack,
        stickers: Array.isArray(pack.stickers) ? pack.stickers : [],
      })),
  };
}
