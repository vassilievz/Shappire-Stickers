import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const verifyIdToken = vi.fn();
  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
      auth: () => ({ verifyIdToken }),
    },
  };
});

vi.mock('../services/donationService.js', () => ({
  createDonation: vi.fn(),
  checkDonationStatus: vi.fn(),
  getUserDonations: vi.fn(),
}));

import admin from 'firebase-admin';
import { createApp } from '../server.js';
import * as donationService from '../services/donationService.js';

const { verifyIdToken } = admin.auth();

let server;
let baseUrl;

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

let seq = 0;
function authUser() {
  seq += 1;
  verifyIdToken.mockReset();
  verifyIdToken.mockResolvedValue({
    uid: `donation-user-${seq}`,
    email: `don-${seq}@example.com`,
  });
  return {
    token: `token-${seq}`,
    uid: `donation-user-${seq}`,
  };
}

beforeEach(() => {
  donationService.createDonation.mockReset();
  donationService.checkDonationStatus.mockReset();
  donationService.getUserDonations.mockReset();
});

describe('Rotas de Doação', () => {
  describe('POST /api/donations', () => {
    it('exige autenticação', async () => {
      const res = await fetch(`${baseUrl}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10 }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('valida presença do campo amount', async () => {
      const { token } = authUser();
      const res = await fetch(`${baseUrl}/api/donations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('cria cobrança PIX com sucesso (201)', async () => {
      const { token, uid } = authUser();
      donationService.createDonation.mockResolvedValue({
        donationId: 'don-123',
        amount: 20,
        copyPaste: 'pix-copy-paste-code',
        expiresAt: '2026-10-11T00:00:00.000Z',
        status: 'PENDING',
      });

      const res = await fetch(`${baseUrl}/api/donations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 20 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.donationId).toBe('don-123');
      expect(body.copyPaste).toBe('pix-copy-paste-code');
      expect(donationService.createDonation).toHaveBeenCalledWith({
        uid,
        amount: 20,
      });
    });
  });

  describe('GET /api/donations/:donationId/status', () => {
    it('exige autenticação', async () => {
      const res = await fetch(`${baseUrl}/api/donations/don-123/status`);
      expect(res.status).toBe(401);
    });

    it('retorna status da doação', async () => {
      const { token, uid } = authUser();
      donationService.checkDonationStatus.mockResolvedValue({
        donationId: 'don-123',
        status: 'PAID',
        paidAt: '2026-10-10T00:05:00.000Z',
        badgeGranted: true,
      });

      const res = await fetch(`${baseUrl}/api/donations/don-123/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('PAID');
      expect(body.badgeGranted).toBe(true);
      expect(donationService.checkDonationStatus).toHaveBeenCalledWith({
        uid,
        donationId: 'don-123',
      });
    });
  });

  describe('GET /api/donations/me', () => {
    it('retorna histórico de doações do usuário', async () => {
      const { token, uid } = authUser();
      donationService.getUserDonations.mockResolvedValue([
        { donationId: 'don-1', amount: 10, status: 'PAID' },
      ]);

      const res = await fetch(`${baseUrl}/api/donations/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.donations).toHaveLength(1);
      expect(donationService.getUserDonations).toHaveBeenCalledWith(uid);
    });
  });
});
