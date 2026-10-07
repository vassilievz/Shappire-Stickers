import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { OtaKit } from '@otakit/capacitor-updater';
import {
  applyOtaUpdate,
  checkOtaUpdate,
  downloadOtaUpdate,
  getOtaStatus,
  notifyAppReadyIfNative,
} from './otaService';
import { APP_INFO } from '@/config/app';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@otakit/capacitor-updater', () => ({
  OtaKit: {
    notifyAppReady: vi.fn(),
    getState: vi.fn(),
    check: vi.fn(),
    download: vi.fn(),
    apply: vi.fn(),
    getLastFailure: vi.fn(),
  },
}));

describe('otaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyAppReadyIfNative', () => {
    it('não executa notifyAppReady no navegador (ambiente web)', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const notified = await notifyAppReadyIfNative();
      expect(notified).toBe(false);
      expect(OtaKit.notifyAppReady).not.toHaveBeenCalled();
    });

    it('executa notifyAppReady na plataforma nativa', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.notifyAppReady).mockResolvedValue(undefined);

      const notified = await notifyAppReadyIfNative();
      expect(notified).toBe(true);
      expect(OtaKit.notifyAppReady).toHaveBeenCalledTimes(1);

      // Não chama pela segunda vez na mesma sessão
      const secondCall = await notifyAppReadyIfNative();
      expect(secondCall).toBe(false);
      expect(OtaKit.notifyAppReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOtaStatus', () => {
    it('retorna a versão estática padrão no navegador', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const status = await getOtaStatus();
      expect(status.isNative).toBe(false);
      expect(status.currentVersion).toBe(APP_INFO.version);
      expect(status.hasStagedUpdate).toBe(false);
    });

    it('retorna os dados do OtaKit na plataforma nativa', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.getState).mockResolvedValue({
        current: {
          id: 'bundle-1',
          version: '0.2.1',
          status: 'success' as any,
        },
        fallback: { id: 'fallback', version: '0.2.0', status: 'builtin' as any },
        staged: { id: 'staged-1', version: '0.3.0', status: 'pending' as any },
        builtinVersion: '0.2.0',
        rollout: null,
        preview: null,
      });
      vi.mocked(OtaKit.getLastFailure).mockResolvedValue(null);

      const status = await getOtaStatus();
      expect(status.isNative).toBe(true);
      expect(status.currentVersion).toBe('0.2.1');
      expect(status.stagedVersion).toBe('0.3.0');
      expect(status.hasStagedUpdate).toBe(true);
    });
  });

  describe('checkOtaUpdate', () => {
    it('retorna unsupported no navegador', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const res = await checkOtaUpdate();
      expect(res.kind).toBe('unsupported');
    });

    it('detecta quando está atualizado', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.check).mockResolvedValue({ kind: 'no_update' });

      const res = await checkOtaUpdate();
      expect(res.kind).toBe('up_to_date');
    });

    it('detecta nova atualização disponível', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.check).mockResolvedValue({
        kind: 'update_available',
        latest: {
          version: '0.3.0',
          size: 1048576,
          sha256: 'abc',
          releaseId: 'rel-1',
        },
      });

      const res = await checkOtaUpdate();
      expect(res.kind).toBe('update_available');
      if (res.kind === 'update_available') {
        expect(res.version).toBe('0.3.0');
        expect(res.size).toBe(1048576);
      }
    });
  });

  describe('downloadOtaUpdate', () => {
    it('retorna staged quando o download for bem-sucedido', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.download).mockResolvedValue({
        kind: 'staged',
        bundle: { id: 'b1', version: '0.3.0', status: 'pending' as any },
      });

      const res = await downloadOtaUpdate();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.stagedVersion).toBe('0.3.0');
      }
    });
  });

  describe('applyOtaUpdate', () => {
    it('chama OtaKit.apply na plataforma nativa', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.apply).mockResolvedValue(undefined);

      await applyOtaUpdate();
      expect(OtaKit.apply).toHaveBeenCalledTimes(1);
    });
  });
});
