import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ROUTES } from '@shappire/contracts';
import { apiRequest, getApiBaseUrl, OFFLINE_MESSAGE } from './client';
import { AppError } from '@/shared/errors';

const mocks = vi.hoisted(() => ({
  currentUser: null as { uid: string; photoURL: string | null; getIdToken: () => Promise<string> } | null,
}));

vi.mock('@/services/firebase/config', () => ({
  getFirebaseAuth: () => ({ currentUser: mocks.currentUser }),
}));

const fetchMock = vi.fn();

function setUser(): void {
  mocks.currentUser = {
    uid: 'user-1',
    photoURL: null,
    getIdToken: async () => 'token-123',
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://10.0.2.2:8080');
  vi.stubGlobal('fetch', fetchMock);
  setUser();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'onLine');
  mocks.currentUser = null;
  fetchMock.mockReset();
});

describe('getApiBaseUrl', () => {
  it('usa a VITE_API_URL pública sem barras finais', () => {
    expect(getApiBaseUrl()).toBe('http://10.0.2.2:8080');

    vi.stubEnv('VITE_API_URL', '  https://api.exemplo.com/  ');
    expect(getApiBaseUrl()).toBe('https://api.exemplo.com');
  });

  it('lança API_NOT_CONFIGURED quando a URL não está definida', () => {
    vi.stubEnv('VITE_API_URL', '');

    let thrown: unknown;
    try {
      getApiBaseUrl();
    } catch (error) {
      thrown = error;
    }
    expect(AppError.is(thrown)).toBe(true);
    expect((thrown as AppError).code).toBe('API_NOT_CONFIGURED');
  });
});

describe('apiRequest — requisição autenticada (§9/§20)', () => {
  it('envia Bearer token, método GET padrão e junta base + rota', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const response = await apiRequest(API_ROUTES.profile);

    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:8080/api/profile', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' },
      body: undefined,
      signal: expect.any(AbortSignal),
    });
  });

  it('sem usuário logado lança UNAUTHORIZED sem chamar o fetch', async () => {
    mocks.currentUser = null;

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corpo string recebe Content-Type application/json', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest(API_ROUTES.profile, { method: 'PATCH', body: JSON.stringify({ bio: 'oi' }) });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    });
  });

  it('corpo FormData não recebe Content-Type manual (multipart é do browser)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'avatar.png');

    await apiRequest(API_ROUTES.avatar, { method: 'POST', body: form });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ Authorization: 'Bearer token-123' });
  });
});

describe('apiRequest — offline (§22)', () => {
  it('navigator offline lança OFFLINE com a mensagem da diretiva, sem fetch', async () => {
    setOnline(false);

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'OFFLINE',
      message: OFFLINE_MESSAGE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeição de rede do fetch vira OFFLINE', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'OFFLINE',
      message: OFFLINE_MESSAGE,
    });
  });
});

describe('apiRequest — timeout', () => {
  it('timeout aborta a requisição e vira NETWORK_ERROR', async () => {
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    await expect(apiRequest(API_ROUTES.profile, { timeoutMs: 25 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

describe('apiRequest — mapeamento de erros (§28)', () => {
  it('mapeia PROFILE_NOT_FOUND com reason para a camada superior', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado.' }),
    );

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { reason: 'PROFILE_NOT_FOUND', httpStatus: 404 },
    });
  });

  it('mapeia USERNAME_TAKEN com field para a UI', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'USERNAME_TAKEN', message: 'Já em uso.' }));

    await expect(
      apiRequest(API_ROUTES.profile, { method: 'PATCH', body: '{}' }),
    ).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      details: { field: 'username', reason: 'USERNAME_TAKEN' },
    });
  });

  it('mapeia VALIDATION_ERROR para INVALID_INPUT', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'VALIDATION_ERROR', message: 'Dados inválidos.' }),
    );

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { httpStatus: 400 },
    });
  });

  it('mapeia PAYLOAD_TOO_LARGE para IMAGE_TOO_LARGE', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(413, { error: 'PAYLOAD_TOO_LARGE', message: 'Muito grande.' }),
    );

    await expect(apiRequest(API_ROUTES.avatar, { method: 'POST', body: new FormData() })).rejects.toMatchObject({
      code: 'IMAGE_TOO_LARGE',
    });
  });

  it('mapeia UNSUPPORTED_MEDIA_TYPE para UNSUPPORTED_FORMAT', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(415, { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo não suportado.' }),
    );

    await expect(apiRequest(API_ROUTES.avatar, { method: 'POST', body: new FormData() })).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('mapeia RATE_LIMIT_EXCEEDED com ou sem corpo JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: 'RATE_LIMIT_EXCEEDED', message: 'Aguarde.' }),
    );
    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });

    fetchMock.mockResolvedValueOnce(jsonResponse(429, undefined));
    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('código desconhecido (ex.: INTERNAL_ERROR) vira UNKNOWN sem vazar detalhes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { error: 'INTERNAL_ERROR', message: 'Erro interno.' }),
    );

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'UNKNOWN',
      details: { httpStatus: 500 },
    });
  });

  it('sem corpo JSON usa apenas o status HTTP (502 → UNKNOWN)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, undefined));

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({
      code: 'UNKNOWN',
      details: { httpStatus: 502 },
    });
  });

  it('401 sem corpo JSON vira UNAUTHORIZED pelo status', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, undefined));

    await expect(apiRequest(API_ROUTES.profile)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
