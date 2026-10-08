import { logEvent } from 'firebase/analytics';
import { getFirebaseAnalytics } from './config';
import type { AnalyticsEventName, AnalyticsParams } from './types';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('firebase-analytics');

/**
 * Registra um evento métrico no Firebase Analytics de forma segura.
 * - Não quebra a aplicação caso o Analytics esteja offline, bloqueado por adblocker ou não suportado.
 * - Coleta estritamente mínima e anônima (sem dados de conteúdo de imagens, texto de figurinhas ou segredos).
 */
export async function logAnalyticsEvent(
  eventName: AnalyticsEventName,
  params?: AnalyticsParams,
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) {
      logger.debug(`Analytics não disponível para evento: ${eventName}`);
      return;
    }

    // Sanitiza parâmetros: apenas tipos primitivos permitidos
    const safeParams: Record<string, string | number | boolean> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
          safeParams[key] = value;
        }
      }
    }

    logEvent(analytics, eventName, safeParams);
    logger.debug(`Evento registrado: ${eventName}`, safeParams);
  } catch (error) {
    // Analytics nunca deve propagar erro para a UI
    logger.debug(`Falha ao registrar evento '${eventName}':`, error);
  }
}
