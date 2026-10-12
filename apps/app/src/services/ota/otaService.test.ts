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
    it('não executa notifyAppReady no navegador', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const notified = await notifyAppReadyIfNative();
      expect(notified).toBe(false);
      expect(OtaKit.notifyAppReady).not.toHaveBeenCalled();
    });

    it('executa notifyAppReady na plataforma nativa uma vez por sessão', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.notifyAppReady).mockResolvedValue(undefined);

      const notified = await notifyAppReadyIfNative();
      expect(notified).toBe(true);
      expect(OtaKit.notifyAppReady).toHaveBeenCalledTimes(1);

      const secondCall = await notifyAppReadyIfNative();
      expect(secondCall).toBe(false);
      expect(OtaKit.notifyAppReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOtaStatus', () => {
    it('retorna a versão estática no navegador', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const status = await getOtaStatus();
      expect(status.isNative).toBe(false);
      expect(status.currentVersion).toBe(APP_INFO.version);
      expect(status.hasStagedUpdate).toBe(false);
    });
  });

  describe('checkOtaUpdate', () => {
    it('retorna unsupported no navegador', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const res = await checkOtaUpdate();
      expect(res.kind).toBe('unsupported');
    });
  });

  describe('downloadOtaUpdate', () => {
    it('retorna staged quando o download for bem-sucedido', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(OtaKit.download).mockResolvedValue({
        kind: 'staged',
        bundle: { id: 'b1', version: '0.3.1', status: 'pending' as never },
      });

      const res = await downloadOtaUpdate();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.stagedVersion).toBe('0.3.1');
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
