import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPixCharge, getPixStatus } from './goatPayService.js';
import { env } from '../config/env.js';

describe('goatPayService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPixCharge', () => {
    it('falha com 503 se GOAT_API_KEY não estiver configurada', async () => {
      const originalKey = env.goatApiKey;
      env.goatApiKey = '';
      try {
        await expect(
          createPixCharge({ amount: 10, externalReference: 'ref-1' }),
        ).rejects.toThrowError(/não está configurada/);
      } finally {
        env.goatApiKey = originalKey;
      }
    });

    it('envia requisição correta e retorna dados do PIX com copyPaste', async () => {
      const originalKey = env.goatApiKey;
      env.goatApiKey = 'gp_live_mock_key';

      const mockResponse = {
        success: true,
        message: 'Pagamento PIX criado com sucesso',
        data: {
          id: 'clx_12345',
          status: 'PENDING',
          amount: 10,
          copyPaste: '000201010212...',
          expiresAt: '2026-10-11T00:00:00.000Z',
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      try {
        const result = await createPixCharge({
          amount: 10,
          description: 'Apoio voluntário Shappire Stickers',
          externalReference: 'don-uuid-1',
        });

        expect(fetchSpy).toHaveBeenCalledWith(
          'https://api.goatpay.com.br/v1/payment-pix/create',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'gp_live_mock_key',
            },
            body: JSON.stringify({
              amount: 10,
              description: 'Apoio voluntário Shappire Stickers',
              externalReference: 'don-uuid-1',
              coverFee: false,
              expirationSeconds: 86400,
            }),
          }),
        );

        expect(result).toEqual({
          id: 'clx_12345',
          status: 'PENDING',
          amount: 10,
          copyPaste: '000201010212...',
          expiresAt: new Date('2026-10-11T00:00:00.000Z'),
        });
      } finally {
        env.goatApiKey = originalKey;
      }
    });

    it('lança ApiError com mensagem do gateway em caso de erro da GoatPay', async () => {
      const originalKey = env.goatApiKey;
      env.goatApiKey = 'gp_live_mock_key';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, message: 'Valor mínimo R$ 1,00' }),
      });

      try {
        await expect(
          createPixCharge({ amount: 0.5, externalReference: 'don-1' }),
        ).rejects.toThrowError('Valor mínimo R$ 1,00');
      } finally {
        env.goatApiKey = originalKey;
      }
    });
  });

  describe('getPixStatus', () => {
    it('consulta status do PIX na GoatPay e retorna objeto formatado', async () => {
      const originalKey = env.goatApiKey;
      env.goatApiKey = 'gp_live_mock_key';

      const mockResponse = {
        success: true,
        message: 'Status do pagamento PIX consultado',
        data: {
          id: 'clx_12345',
          status: 'COMPLETED',
          amount: 10,
          completedAt: '2026-10-10T01:00:00.000Z',
          endToEndId: 'E1234567890',
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      try {
        const result = await getPixStatus('clx_12345');

        expect(fetchSpy).toHaveBeenCalledWith(
          'https://api.goatpay.com.br/v1/payment-pix/status/clx_12345',
          expect.objectContaining({
            method: 'GET',
            headers: { 'X-API-Key': 'gp_live_mock_key' },
          }),
        );

        expect(result).toEqual({
          id: 'clx_12345',
          status: 'COMPLETED',
          amount: 10,
          completedAt: new Date('2026-10-10T01:00:00.000Z'),
          endToEndId: 'E1234567890',
        });
      } finally {
        env.goatApiKey = originalKey;
      }
    });
  });
});
