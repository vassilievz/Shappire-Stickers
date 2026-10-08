import { describe, it, expect, vi, afterEach } from 'vitest';
import { V0XError, uploadFile, getFile, deleteFile } from './v0xService.js';

const BASE_URL = 'https://api.v0x.lol/api/v1';
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function stubFetch() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadFile', () => {
  it('envia multipart para POST /files com a chave do ambiente no Authorization', async () => {
    const fetchMock = stubFetch().mockResolvedValue(
      jsonResponse(
        {
          id: 'file-1',
          name: 'avatar.png',
          mime_type: 'image/png',
          size_bytes: PNG_BYTES.length,
          url: 'https://cdn.v0x.lol/file-1.png',
          created_at: '2026-01-01T00:00:00Z',
        },
        201,
      ),
    );

    const result = await uploadFile(PNG_BYTES, 'avatar.png', 'image/png');

    expect(result).toEqual({
      fileId: 'file-1',
      url: 'https://cdn.v0x.lol/file-1.png',
      mimeType: 'image/png',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/files`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${process.env.V0X_API}`);
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('usa o mimeType enviado quando a resposta não traz mime_type', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ id: 'file-1', url: 'https://cdn.v0x.lol/file-1' }, 201));

    const result = await uploadFile(PNG_BYTES, 'avatar.png', 'image/png');

    expect(result.mimeType).toBe('image/png');
  });

  it('rejeita resposta sem id como invalid_response', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ url: 'https://cdn.v0x.lol/file-1' }, 201));

    await expect(uploadFile(PNG_BYTES, 'avatar.png', 'image/png')).rejects.toMatchObject({
      name: 'V0XError',
      code: 'invalid_response',
    });
  });

  it('rejeita resposta sem url como invalid_response', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ id: 'file-1' }, 201));

    await expect(uploadFile(PNG_BYTES, 'avatar.png', 'image/png')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('deleteFile', () => {
  it('chama DELETE /files/{id} e propaga o código de erro do V0X', async () => {
    const fetchMock = stubFetch().mockResolvedValue(jsonResponse({ error: 'rate_limit_exceeded' }, 429));

    const error = await deleteFile('file-1').catch((err) => err);

    expect(error).toBeInstanceOf(V0XError);
    expect(error.code).toBe('rate_limit_exceeded');
    expect(error.status).toBe(429);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/files/file-1`);
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe(`Bearer ${process.env.V0X_API}`);
    expect(error.message).not.toContain(process.env.V0X_API);
  });

  it('traduz corpo de erro não-JSON para http_<status>', async () => {
    stubFetch().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('corpo não-JSON');
      },
    });

    await expect(deleteFile('file-1')).rejects.toMatchObject({ code: 'http_500', status: 500 });
  });
});

describe('getFile', () => {
  it('busca GET /files/{id} com id codificado', async () => {
    const fetchMock = stubFetch().mockResolvedValue(
      jsonResponse({
        id: 'a b/1',
        name: 'x.png',
        mime_type: 'image/png',
        size_bytes: 1,
        url: 'https://cdn.v0x.lol/a.png',
        created_at: '2026-01-01T00:00:00Z',
      }),
    );

    const result = await getFile('a b/1');

    expect(result.id).toBe('a b/1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/files/a%20b%2F1`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${process.env.V0X_API}`);
  });
});

describe('falhas de rede', () => {
  it('mapeia AbortError para timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    stubFetch().mockRejectedValue(abortError);

    await expect(getFile('file-1')).rejects.toMatchObject({ code: 'timeout', status: null });
  });

  it('mapeia falha genérica de rede para network_error', async () => {
    stubFetch().mockRejectedValue(new TypeError('fetch failed'));

    await expect(getFile('file-1')).rejects.toMatchObject({ code: 'network_error' });
  });
});
