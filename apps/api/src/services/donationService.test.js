import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/Donation.js', () => {
  class Donation {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn(async () => this);
    }
  }
  Donation.findOne = vi.fn();
  Donation.find = vi.fn();
  return { Donation };
});

vi.mock('./goatPayService.js', () => ({
  createPixCharge: vi.fn(),
  getPixStatus: vi.fn(),
}));

vi.mock('./userService.js', () => ({
  grantBadge: vi.fn(),
}));

import { Donation } from '../models/Donation.js';
import * as goatPayService from './goatPayService.js';
import * as userService from './userService.js';
import { createDonation, checkDonationStatus, getUserDonations } from './donationService.js';

describe('donationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDonation', () => {
    it('valida valor mínimo e máximo', async () => {
      await expect(createDonation({ uid: 'u1', amount: 4.99 })).rejects.toThrowError(
        /O valor deve ser entre/,
      );
      expect(goatPayService.createPixCharge).not.toHaveBeenCalled();
      await expect(createDonation({ uid: 'u1', amount: 0.5 })).rejects.toThrowError(
        /O valor deve ser entre/,
      );
      await expect(createDonation({ uid: 'u1', amount: 6000 })).rejects.toThrowError(
        /O valor deve ser entre/,
      );
      await expect(createDonation({ uid: 'u1', amount: NaN })).rejects.toThrowError(
        /O valor deve ser entre/,
      );
    });

    it('aceita R$ 5,00 (mínimo) e cria cobrança', async () => {
      goatPayService.createPixCharge.mockResolvedValue({
        id: 'clx_min',
        status: 'PENDING',
        amount: 5,
        copyPaste: 'pix',
        expiresAt: new Date(),
      });
      const res = await createDonation({ uid: 'u1', amount: 5 });
      expect(res.amount).toBe(5);
      expect(goatPayService.createPixCharge).toHaveBeenCalledTimes(1);
    });

    it('cria cobrança na GoatPay e persiste a doação', async () => {
      goatPayService.createPixCharge.mockResolvedValue({
        id: 'clx_abc',
        status: 'PENDING',
        amount: 20,
        copyPaste: '00020126580014br.gov.bcb.pix...',
        expiresAt: new Date('2026-10-11T00:00:00Z'),
      });

      const res = await createDonation({ uid: 'user-1', amount: 20 });

      expect(goatPayService.createPixCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 20,
          description: 'Apoio voluntário Shappire Stickers',
          externalReference: res.donationId,
        }),
      );

      expect(res.amount).toBe(20);
      expect(res.copyPaste).toBe('00020126580014br.gov.bcb.pix...');
      expect(res.status).toBe('PENDING');
    });
  });

  describe('checkDonationStatus', () => {
    it('lança 404 se a doação não for encontrada', async () => {
      Donation.findOne.mockResolvedValue(null);
      await expect(
        checkDonationStatus({ uid: 'u1', donationId: 'invalid' }),
      ).rejects.toThrowError(/não encontrada/);
    });

    it('se já está PAID, não chama GoatPay e devolve status pago', async () => {
      const mockDoc = {
        donationId: 'don-1',
        firebaseUid: 'u1',
        status: 'PAID',
        paidAt: new Date('2026-10-10T00:00:00Z'),
        badgeGranted: true,
      };
      Donation.findOne.mockResolvedValue(mockDoc);

      const res = await checkDonationStatus({ uid: 'u1', donationId: 'don-1' });

      expect(res.status).toBe('PAID');
      expect(res.badgeGranted).toBe(true);
      expect(goatPayService.getPixStatus).not.toHaveBeenCalled();
    });

    it('respeita o cooldown de 4s para evitar spam na GoatPay', async () => {
      const mockDoc = {
        donationId: 'don-1',
        firebaseUid: 'u1',
        status: 'PENDING',
        lastCheckedAt: new Date(Date.now() - 1000), // checado há 1 segundo atrás
        badgeGranted: false,
      };
      Donation.findOne.mockResolvedValue(mockDoc);

      const res = await checkDonationStatus({ uid: 'u1', donationId: 'don-1' });

      expect(res.status).toBe('PENDING');
      expect(goatPayService.getPixStatus).not.toHaveBeenCalled();
    });

    it('quando GoatPay confirma pagamento, concede badge initial_supporter de forma permanente', async () => {
      const mockDoc = {
        donationId: 'don-1',
        firebaseUid: 'u1',
        goatpayId: 'clx_123',
        status: 'PENDING',
        lastCheckedAt: new Date(Date.now() - 10000), // checado há 10 segundos atrás
        badgeGranted: false,
        save: vi.fn(),
      };
      Donation.findOne.mockResolvedValue(mockDoc);

      goatPayService.getPixStatus.mockResolvedValue({
        id: 'clx_123',
        status: 'COMPLETED',
        amount: 50,
        completedAt: new Date('2026-10-10T00:05:00Z'),
      });

      userService.grantBadge.mockResolvedValue({ badges: ['initial_supporter'] });

      const res = await checkDonationStatus({
        uid: 'u1',
        donationId: 'don-1',
        email: 'user@example.com',
      });

      expect(res.status).toBe('PAID');
      expect(res.badgeGranted).toBe(true);
      expect(mockDoc.status).toBe('PAID');
      expect(mockDoc.badgeGranted).toBe(true);
      expect(userService.grantBadge).toHaveBeenCalledWith('u1', 'initial_supporter', {
        email: 'user@example.com',
      });
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('quando cancelado/expirado, atualiza status da doação sem tocar nas badges', async () => {
      const mockDoc = {
        donationId: 'don-1',
        firebaseUid: 'u1',
        goatpayId: 'clx_123',
        status: 'PENDING',
        lastCheckedAt: new Date(Date.now() - 10000),
        badgeGranted: false,
        save: vi.fn(),
      };
      Donation.findOne.mockResolvedValue(mockDoc);

      goatPayService.getPixStatus.mockResolvedValue({
        id: 'clx_123',
        status: 'CANCELED',
      });

      const res = await checkDonationStatus({ uid: 'u1', donationId: 'don-1' });

      expect(res.status).toBe('EXPIRED');
      expect(mockDoc.status).toBe('EXPIRED');
      expect(userService.grantBadge).not.toHaveBeenCalled();
    });
  });

  describe('getUserDonations', () => {
    it('retorna lista das doações do usuário ordenadas', async () => {
      const mockDocs = [
        {
          donationId: 'don-1',
          amount: 20,
          status: 'PAID',
          paidAt: new Date('2026-10-10T00:00:00Z'),
          createdAt: new Date('2026-10-10T00:00:00Z'),
          badgeGranted: true,
        },
      ];
      Donation.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockDocs),
        }),
      });

      const list = await getUserDonations('u1');
      expect(list).toHaveLength(1);
      expect(list[0].donationId).toBe('don-1');
      expect(list[0].amount).toBe(20);
      expect(list[0].status).toBe('PAID');
    });
  });
});
