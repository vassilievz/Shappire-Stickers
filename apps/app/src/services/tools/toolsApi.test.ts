import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToolsApiError,
  fetchImageAsDataUrl,
  requestMediaDownload,
  resolveToolsUrl,
} from './toolsApi';

describe('toolsApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveToolsUrl', () => {
    it('retorna a url original se já for absoluta http ou https', () => {
      expect(resolveToolsUrl('https://example.com/video.mp4')).toBe('https://example.com/video.mp4');
      expect(resolveToolsUrl('http://example.com/audio.mp3')).toBe('http://example.com/audio.mp3');
    });

    it('combina caminho relativo com o baseUrl da API', () => {
      expect(resolveToolsUrl('/tunnel?id=123', 'https://api.shappire.tools')).toBe(
        'https://api.shappire.tools/tunnel?id=123',
      );
      expect(resolveToolsUrl('tunnel?id=123', 'https://api.shappire.tools/')).toBe(
        'https://api.shappire.tools/tunnel?id=123',
      );
    });

    it('retorna string vazia para entrada vazia', () => {
      expect(resolveToolsUrl('')).toBe('');
    });
  });

  describe('requestMediaDownload', () => {
    it('envia payload correto e retorna sucesso redirect/tunnel', async () => {
      const mockResult = {
        status: 'redirect',
        url: 'https://cdn.example.com/media.mp4',
        filename: 'video.mp4',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const result = await requestMediaDownload({
        url: 'https://www.tiktok.com/@user/video/12345',
        downloadMode: 'auto',
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toContain('api.shappire.tools');
      expect(JSON.parse(init.body)).toMatchObject({
        url: 'https://www.tiktok.com/@user/video/12345',
        downloadMode: 'auto',
      });
      expect(result).toEqual(mockResult);
    });

    it('lida com picker em carrossel', async () => {
      const mockPickerResult = {
        status: 'picker',
        picker: [
          { type: 'photo', url: 'https://cdn.example.com/1.jpg', thumb: 'https://cdn.example.com/1_t.jpg' },
          { type: 'photo', url: 'https://cdn.example.com/2.jpg', thumb: 'https://cdn.example.com/2_t.jpg' },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPickerResult,
      } as Response);

      const result = await requestMediaDownload({
        url: 'https://www.instagram.com/p/12345',
      });

      expect(result.status).toBe('picker');
      expect(result.picker).toHaveLength(2);
    });

    it('lança ToolsApiError com código retornado pelo backend de erro', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          status: 'error',
          error: { code: 'error.service.unsupported' },
        }),
      } as Response);

      await expect(
        requestMediaDownload({ url: 'https://example.com/not-supported' }),
      ).rejects.toThrow(ToolsApiError);

      try {
        await requestMediaDownload({ url: 'https://example.com/not-supported' });
      } catch (err: any) {
        expect(err.code).toBe('error.service.unsupported');
      }
    });

    it('lança erro de conexão caso o fetch falhe na rede', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      await expect(
        requestMediaDownload({ url: 'https://www.tiktok.com/@user/video/123' }),
      ).rejects.toMatchObject({
        code: 'error.api.connection',
      });
    });
  });

  describe('fetchImageAsDataUrl', () => {
    it('busca a imagem e converte para data url base64', async () => {
      const mockBlob = new Blob(['dummy-image-bytes'], { type: 'image/png' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      } as Response);

      const dataUrl = await fetchImageAsDataUrl('https://example.com/image.png');
      expect(dataUrl).toContain('data:image/png;base64,');
    });

    it('lança erro caso a requisição da imagem falhe', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchImageAsDataUrl('https://example.com/not-found.png')).rejects.toMatchObject({
        code: 'error.media.fetch_failed',
      });
    });
  });
});
