import { v0xConfig } from '../config/v0x.js';

/**
 * Toda a comunicação com a API V0X passa por aqui (§17). A chave secreta
 * (V0X_API) é lida do ambiente e usada apenas no header Authorization —
 * nunca logada, nunca retornada, nunca enviada como parâmetro.
 */
export class V0XError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = 'V0XError';
    this.code = code;
    this.status = status;
  }
}

async function v0xRequest(pathname, { method = 'GET', body = undefined, timeoutMs = v0xConfig.timeouts.request } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${v0xConfig.baseUrl}${pathname}`, {
      method,
      headers: { Authorization: `Bearer ${v0xConfig.apiKey}` },
      body,
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // corpo não-JSON — tratado abaixo pelo status
    }

    if (!response.ok) {
      throw new V0XError(
        payload?.error ?? `http_${response.status}`,
        `V0X respondeu com status ${response.status}.`,
        response.status,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof V0XError) throw error;
    if (error?.name === 'AbortError') {
      throw new V0XError('timeout', 'V0X não respondeu dentro do tempo limite.');
    }
    throw new V0XError('network_error', 'Falha de comunicação com o V0X.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia um arquivo ao V0X (POST /files, multipart campo `file`).
 * Retorna { fileId, url, mimeType } — o MongoDB guarda só isso (§13).
 */
export async function uploadFile(buffer, filename, mimeType) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  const payload = await v0xRequest('/files', {
    method: 'POST',
    body: form,
    timeoutMs: v0xConfig.timeouts.upload,
  });
  if (!payload?.id || !payload?.url) {
    throw new V0XError('invalid_response', 'Resposta do V0X sem id/url do arquivo.');
  }
  return {
    fileId: payload.id,
    url: payload.url,
    mimeType: payload.mime_type ?? mimeType,
  };
}

export async function getFile(fileId) {
  return v0xRequest(`/files/${encodeURIComponent(fileId)}`);
}

export async function deleteFile(fileId) {
  await v0xRequest(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}
