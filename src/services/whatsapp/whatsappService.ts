import { WHATSAPP_INTENT } from '@/config/whatsapp';
import type { StickerPack } from '@/domain/stickerPack';
import { validateStickerPack, type ValidationResult } from '@/domain/validation/whatsappRules';
import { AppError, toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { loadPacks } from '@/services/storage/packRepository';
import {
  readPackFilesInfo,
  trayFileExists,
  writeWhatsAppContents,
} from './stickerPackExporter';
import {
  StickerPackNative,
  type AddToWhatsAppResult,
  type PackAddedState,
  type StickerPackNativeStatus,
} from './whatsappNative';
import { logAnalyticsEvent } from '@/services/firebase/analytics';

const log = createLogger('whatsapp-service');

export interface WhatsAppCapabilities {
  nativeAvailable: boolean;
  consumerInstalled: boolean;
  businessInstalled: boolean;
  authority: string;
  androidSdk: number;
  filesDirectory: string;
}

const FALLBACK_CAPABILITIES: WhatsAppCapabilities = {
  nativeAvailable: false,
  consumerInstalled: false,
  businessInstalled: false,
  authority: 'com.shappire.stickers.stickercontentprovider',
  androidSdk: 0,
  filesDirectory: '',
};

let capabilitiesCache: WhatsAppCapabilities | null = null;


export async function getWhatsAppCapabilities(force = false): Promise<WhatsAppCapabilities> {
  if (capabilitiesCache && !force) return capabilitiesCache;
  try {
    const status: StickerPackNativeStatus = await StickerPackNative.getStatus();
    capabilitiesCache = {
      nativeAvailable: status.available,
      consumerInstalled: status.whatsappConsumerInstalled,
      businessInstalled: status.whatsappBusinessInstalled,
      authority: status.authority,
      androidSdk: status.androidSdk,
      filesDirectory: status.filesDirectory,
    };
  } catch (error) {
    log.warn('Não foi possível consultar o plugin nativo', error);
    capabilitiesCache = { ...FALLBACK_CAPABILITIES };
  }
  return capabilitiesCache;
}

export function resetCapabilitiesCache(): void {
  capabilitiesCache = null;
}


export async function syncWhatsAppContents(): Promise<void> {
  const packs = await loadPacks();
  await writeWhatsAppContents(packs);
}


export async function validatePackForWhatsApp(
  pack: StickerPack,
): Promise<{ rules: ValidationResult; native: Awaited<ReturnType<typeof StickerPackNative.validateStickerPack>> | null }> {
  const files = await readPackFilesInfo(pack);
  const trayExists = await trayFileExists(pack);
  const rules = validateStickerPack(pack, { files, trayFileExists: trayExists });

  const capabilities = await getWhatsAppCapabilities();
  if (!capabilities.nativeAvailable) {
    return { rules, native: null };
  }

  await syncWhatsAppContents();
  await StickerPackNative.refreshStickerPacks();

  const native = await StickerPackNative.validateStickerPack({ identifier: pack.id });
  return { rules, native };
}


export async function addPackToWhatsApp(pack: StickerPack): Promise<AddToWhatsAppResult> {
  const capabilities = await getWhatsAppCapabilities();

  if (!capabilities.nativeAvailable) {
    throw new AppError(
      'NATIVE_UNAVAILABLE',
      'Abra o aplicativo instalado no Android para adicionar o pacote ao WhatsApp.',
    );
  }
  if (!capabilities.consumerInstalled && !capabilities.businessInstalled) {
    throw new AppError(
      'WHATSAPP_NOT_INSTALLED',
      'O WhatsApp não está instalado neste aparelho. Instale-o e tente novamente.',
      { details: { whatSappIntent: WHATSAPP_INTENT.actionEnableStickerPack } },
    );
  }

  await syncWhatsAppContents();
  await StickerPackNative.refreshStickerPacks();

  try {
    const result = await StickerPackNative.addStickerPackToWhatsApp({
      identifier: pack.id,
      packName: pack.name,
    });
    log.info(`Resultado do WhatsApp: ${result.outcome}`);
    void logAnalyticsEvent('whatsapp_export', { pack_id: pack.id, outcome: result.outcome });
    return result;
  } catch (error) {
    throw toAppError(error, 'WHATSAPP_ADD_FAILED');
  }
}


export async function getPackAddedState(packId: string): Promise<PackAddedState | null> {
  const capabilities = await getWhatsAppCapabilities();
  if (!capabilities.nativeAvailable) return null;
  if (!capabilities.consumerInstalled && !capabilities.businessInstalled) return null;
  try {
    return await StickerPackNative.isStickerPackAdded({ identifier: packId });
  } catch (error) {
    log.warn('Falha ao consultar whitelist do WhatsApp', error);
    return null;
  }
}


export async function openWhatsAppStorePage(): Promise<boolean> {
  try {
    const result = await StickerPackNative.openPlayStore({ packageName: WHATSAPP_INTENT.consumerPackage });
    return result.opened;
  } catch {
    return false;
  }
}
