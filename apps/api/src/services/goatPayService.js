import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

const GOATPAY_BASE_URL = 'https://api.goatpay.com.br/v1';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Cliente HTTP para a API pública GoatPay.
 * Nenhuma chave é exposta para o cliente / frontend.
 */
export async function createPixCharge({
  amount,
  description = 'Apoio voluntário Shappire Stickers',
  externalReference,
  expirationSeconds = 86400,
}) {
  if (!env.goatApiKey) {
    throw new ApiError(
      503,
      'PAYMENT_GATEWAY_ERROR',
      'Integração de pagamento GoatPay não está configurada.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GOATPAY_BASE_URL}/payment-pix/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.goatApiKey,
      },
      body: JSON.stringify({
        amount,
        description,
        externalReference,
        coverFee: false,
        expirationSeconds,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      const message = data?.message || `Falha ao criar cobrança PIX (HTTP ${response.status})`;
      throw new ApiError(502, 'PAYMENT_GATEWAY_ERROR', message);
    }

    const pixData = data.data;
    if (!pixData || !pixData.copyPaste) {
      throw new ApiError(
        502,
        'PAYMENT_GATEWAY_ERROR',
        'Resposta inválida da GoatPay: copyPaste ausente.',
      );
    }

    return {
      id: pixData.id,
      status: pixData.status || 'PENDING',
      amount: pixData.amount ?? amount,
      copyPaste: pixData.copyPaste,
      expiresAt: pixData.expiresAt ? new Date(pixData.expiresAt) : null,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(504, 'PAYMENT_GATEWAY_ERROR', 'Timeout na comunicação com a GoatPay.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      502,
      'PAYMENT_GATEWAY_ERROR',
      `Erro de conexão com a GoatPay: ${error.message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta status resumido da cobrança PIX na GoatPay (ótimo para polling com baixo tráfego).
 */
export async function getPixStatus(idOrExternalRef) {
  if (!env.goatApiKey) {
    throw new ApiError(
      503,
      'PAYMENT_GATEWAY_ERROR',
      'Integração de pagamento GoatPay não está configurada.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GOATPAY_BASE_URL}/payment-pix/status/${encodeURIComponent(idOrExternalRef)}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': env.goatApiKey,
        },
        signal: controller.signal,
      },
    );

    const data = await response.json().catch(() => null);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok || !data?.success) {
      const message = data?.message || `Falha ao consultar status PIX (HTTP ${response.status})`;
      throw new ApiError(502, 'PAYMENT_GATEWAY_ERROR', message);
    }

    const statusData = data.data;
    return {
      id: statusData.id,
      status: statusData.status, // PENDING, PROCESSING, COMPLETED, FAILED, CANCELED, REVERSED
      amount: statusData.amount,
      completedAt: statusData.completedAt ? new Date(statusData.completedAt) : null,
      endToEndId: statusData.endToEndId ?? null,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(504, 'PAYMENT_GATEWAY_ERROR', 'Timeout na consulta de status com a GoatPay.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      502,
      'PAYMENT_GATEWAY_ERROR',
      `Erro de conexão com a GoatPay: ${error.message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
