import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getFirebaseAuth } from '@/services/firebase/config';
import { AppError, type AppErrorCode } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('api-client');

const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Mensagem exigida pela diretiva (§22) para ações que exigem conexão. */
export const OFFLINE_MESSAGE = 'Você está offline. Esta ação precisa de conexão com a internet.';

export interface ApiRequestInit {
  method?: 'GET' | 'PATCH' | 'POST' | 'DELETE';
  body?: FormData | string;
  timeoutMs?: number;
  /** required: sempre exige token; optional: envia se houver sessão; none: sem Authorization */
  auth?: 'required' | 'optional' | 'none';
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/**
 * Única porta de saída HTTP do app para a API Shappire. Nenhum segredo vive
 * aqui: apenas o URL público (VITE_API_URL) e o ID token do Firebase Auth do
 * usuário logado (§20/§21). O token NUNCA é persistido — é reobtido a cada
 * requisição, e o SDK do Firebase renova automaticamente quando expira.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  const base = (typeof raw === 'string' ? raw : '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new AppError(
      'API_NOT_CONFIGURED',
      'O endereço da API (VITE_API_URL) não está configurado neste ambiente.',
    );
  }
  return base;
}

export async function getAuthToken(): Promise<string> {
  let token: string | null = null;
  const webUser = getFirebaseAuth().currentUser;

  if (webUser) {
    try {
      token = await webUser.getIdToken();
    } catch (err) {
      logger.debug('Falha ao obter token via webUser:', err);
    }
  }

  if (!token && Capacitor.isNativePlatform()) {
    try {
      const res = await FirebaseAuthentication.getIdToken();
      if (res?.token) {
        token = res.token;
      }
    } catch (nativeErr) {
      logger.debug('Falha ao obter token via FirebaseAuthentication nativo:', nativeErr);
    }
  }

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre novamente para continuar.');
  }
  return token;
}

interface MappedApiError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Mapeia o código estável da API (`{error, message}`) para AppError. O app
 * nunca confia na `message` do servidor como chave — só o enum (§28).
 */
function mapApiError(apiCode: string, message: string): MappedApiError {
  switch (apiCode) {
    case 'VALIDATION_ERROR':
      return { code: 'INVALID_INPUT', message: message || 'Dados inválidos.' };
    case 'UNAUTHORIZED':
      return { code: 'UNAUTHORIZED', message: message || 'Sua sessão expirou. Entre novamente.' };
    case 'FORBIDDEN':
      return { code: 'PERMISSION_DENIED', message: message || 'Permissão negada.' };
    case 'NOT_FOUND':
      return { code: 'NOT_FOUND', message: message || 'Item não encontrado.' };
    case 'PROFILE_NOT_FOUND':
      return {
        code: 'NOT_FOUND',
        message: message || 'Perfil ainda não criado.',
        details: { reason: 'PROFILE_NOT_FOUND' },
      };
    case 'USERNAME_TAKEN':
      return {
        code: 'USERNAME_TAKEN',
        message: message || 'Este usuário já está em uso.',
        details: { field: 'username', reason: 'USERNAME_TAKEN' },
      };
    case 'PAYLOAD_TOO_LARGE':
      return { code: 'IMAGE_TOO_LARGE', message: message || 'A imagem excede o tamanho permitido.' };
    case 'UNSUPPORTED_MEDIA_TYPE':
      return { code: 'UNSUPPORTED_FORMAT', message: message || 'Formato de imagem não suportado.' };
    case 'RATE_LIMIT_EXCEEDED':
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.',
      };
    case 'UPLOAD_FAILED':
      return { code: 'UPLOAD_FAILED', message: message || 'Não foi possível enviar a imagem.' };
    case 'PUBLICATION_NOT_FOUND':
      return { code: 'NOT_FOUND', message: message || 'Álbum não encontrado.' };
    case 'COMMENT_NOT_FOUND':
      return { code: 'NOT_FOUND', message: message || 'Comentário não encontrado.' };
    case 'ALREADY_COLLECTED':
      return { code: 'INVALID_INPUT', message: message || 'Álbum já está na sua coleção.' };
    case 'BLOCKED':
      return { code: 'PERMISSION_DENIED', message: message || 'Interação bloqueada.' };
    case 'ADULT_CONTENT_RESTRICTED':
      return { code: 'PERMISSION_DENIED', message: message || 'Conteúdo +18 indisponível.' };
    case 'CONFLICT':
      return { code: 'INVALID_INPUT', message: message || 'Conflito ao processar a ação.' };
    default:
      return { code: 'UNKNOWN', message: message || 'Ocorreu um erro inesperado.' };
  }
}

function toErrorFromStatus(status: number, message: string): MappedApiError {
  if (status === 401) {
    return { code: 'UNAUTHORIZED', message: message || 'Sua sessão expirou. Entre novamente.' };
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', message: message || 'Item não encontrado.' };
  }
  if (status === 429) {
    return { code: 'RATE_LIMIT_EXCEEDED', message: message || 'Muitas tentativas em pouco tempo.' };
  }
  return { code: 'UNKNOWN', message: message || 'O servidor não respondeu como esperado.' };
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toAppErrorFromResponse(status: number, body: unknown): AppError {
  const payload = body as { error?: unknown; message?: unknown } | null;
  const apiCode = typeof payload?.error === 'string' ? payload.error : '';
  const message = typeof payload?.message === 'string' ? payload.message : '';
  const mapped = apiCode
    ? mapApiError(apiCode, message)
    : toErrorFromStatus(status, message);
  return new AppError(mapped.code, mapped.message, {
    details: { ...mapped.details, httpStatus: status },
  });
}

async function resolveAuthToken(mode: ApiRequestInit['auth']): Promise<string | null> {
  const authMode = mode ?? 'required';
  if (authMode === 'none') return null;
  try {
    return await getAuthToken();
  } catch (error) {
    if (authMode === 'optional') return null;
    throw error;
  }
}

export async function apiRequest(path: string, init: ApiRequestInit = {}): Promise<ApiResponse> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AppError('OFFLINE', OFFLINE_MESSAGE);
  }

  const token = await resolveAuthToken(init.auth);
  const endpoint = `${getApiBaseUrl()}${path}`;
  const method = init.method ?? 'GET';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.debug('Requisição abortada por timeout:', path);
      throw new AppError('NETWORK_ERROR', 'A conexão com o servidor demorou demais. Tente novamente.');
    }
    // fetch só rejeita por falha de rede/DNS — offline de fato (§22).
    logger.debug('Falha de rede na requisição:', path);
    throw new AppError('OFFLINE', OFFLINE_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw toAppErrorFromResponse(response.status, await parseBody(response));
  }

  return { status: response.status, body: await parseBody(response) };
}

export { DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS };
