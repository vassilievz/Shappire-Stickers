import { WebPlugin } from '@capacitor/core';
import type {
  AddToWhatsAppResult,
  PackAddedState,
  StickerPackNativeStatus,
  StickerPackPlugin,
  NativeValidationResult,
} from './whatsappNative';


export class StickerPackWeb extends WebPlugin implements StickerPackPlugin {
  private rejectNative<T>(): Promise<T> {
    return Promise.reject(
      new Error('A integração com o WhatsApp está disponível apenas no aplicativo Android.'),
    );
  }

  async getStatus(): Promise<StickerPackNativeStatus> {
    return {
      available: false,
      platform: 'web',
      authority: 'com.shappire.stickers.stickercontentprovider',
      filesDirectory: '(preview no navegador)',
      androidSdk: 0,
      whatsappConsumerInstalled: false,
      whatsappBusinessInstalled: false,
    };
  }

  async validateStickerPack(): Promise<NativeValidationResult> {
    return this.rejectNative<NativeValidationResult>();
  }

  async refreshStickerPacks(): Promise<{ reloaded: boolean }> {
    return { reloaded: false };
  }

  async addStickerPackToWhatsApp(): Promise<AddToWhatsAppResult> {
    return this.rejectNative<AddToWhatsAppResult>();
  }

  async isStickerPackAdded(): Promise<PackAddedState> {
    return this.rejectNative<PackAddedState>();
  }

  async openPlayStore(): Promise<{ opened: boolean }> {
    return this.rejectNative<{ opened: boolean }>();
  }
}
