import { Capacitor, registerPlugin } from '@capacitor/core';


export type WhatsAppVariant = 'consumer' | 'business';

export interface StickerPackNativeStatus {
  
  available: boolean;
  platform: string;
  
  authority: string;
  filesDirectory: string;
  androidSdk: number;
  whatsappConsumerInstalled: boolean;
  whatsappBusinessInstalled: boolean;
}

export interface NativeValidationIssue {
  code: string;
  message: string;
}

export interface NativeValidationResult {
  valid: boolean;
  errors: NativeValidationIssue[];
  warnings: NativeValidationIssue[];
}

export type AddToWhatsAppOutcome = 'added' | 'already_added' | 'cancelled' | 'failed' | 'unavailable';

export interface AddToWhatsAppResult {
  outcome: AddToWhatsAppOutcome;
  message: string;
}

export interface PackAddedState {
  
  consumer: boolean | null;
  business: boolean | null;
}

export interface StickerPackPlugin {
  getStatus(): Promise<StickerPackNativeStatus>;
  validateStickerPack(options: { identifier: string }): Promise<NativeValidationResult>;
  refreshStickerPacks(): Promise<{ reloaded: boolean }>;
  addStickerPackToWhatsApp(options: {
    identifier: string;
    packName: string;
    variant?: WhatsAppVariant;
  }): Promise<AddToWhatsAppResult>;
  isStickerPackAdded(options: { identifier: string }): Promise<PackAddedState>;
  openPlayStore(options?: { packageName?: string }): Promise<{ opened: boolean }>;
}


export const StickerPackNative = registerPlugin<StickerPackPlugin>('StickerPackPlugin', {
  web: () => import('./stickerPackWeb').then((module) => new module.StickerPackWeb()),
});

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
