import { API_ROUTES, type DonationCreateResponse, type DonationStatusResponse } from '@shappire/contracts';
import { apiRequest } from './client';
import { AppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('donation-api');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function createDonation(amount: number): Promise<DonationCreateResponse> {
  const { status, body } = await apiRequest(API_ROUTES.donations, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

  if (status !== 201 || !isRecord(body)) {
    logger.warn('Falha ao criar cobrança de doação.', { status, body });
    throw new AppError('UNKNOWN', 'Não foi possível gerar o código PIX para doação.');
  }

  const { donationId, copyPaste, expiresAt, status: donationStatus } = body;
  if (typeof donationId !== 'string' || typeof copyPaste !== 'string') {
    throw new AppError('DATA_CORRUPTED', 'Resposta inválida do servidor de doações.');
  }

  return {
    donationId,
    amount: typeof body.amount === 'number' ? body.amount : amount,
    copyPaste,
    expiresAt: typeof expiresAt === 'string' ? expiresAt : null,
    status: (typeof donationStatus === 'string' ? donationStatus : 'PENDING') as DonationCreateResponse['status'],
  };
}

export async function getDonationStatus(donationId: string): Promise<DonationStatusResponse> {
  const { status, body } = await apiRequest(`${API_ROUTES.donations}/${encodeURIComponent(donationId)}/status`, {
    method: 'GET',
  });

  if (status !== 200 || !isRecord(body)) {
    logger.warn('Falha ao consultar status da doação.', { status, body });
    throw new AppError('UNKNOWN', 'Não foi possível verificar o pagamento.');
  }

  const { status: donationStatus, paidAt, badgeGranted } = body;
  if (typeof donationStatus !== 'string') {
    throw new AppError('DATA_CORRUPTED', 'Resposta inválida do status de doação.');
  }

  return {
    donationId,
    status: donationStatus as DonationStatusResponse['status'],
    paidAt: typeof paidAt === 'string' ? paidAt : null,
    badgeGranted: Boolean(badgeGranted),
  };
}

export interface UserDonationSummary {
  donationId: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string | null;
  badgeGranted: boolean;
}

export async function getMyDonations(): Promise<UserDonationSummary[]> {
  const { status, body } = await apiRequest(API_ROUTES.myDonations, {
    method: 'GET',
  });

  if (status !== 200 || !isRecord(body) || !Array.isArray(body.donations)) {
    return [];
  }

  return body.donations.filter(isRecord).map((d) => ({
    donationId: String(d.donationId || ''),
    amount: Number(d.amount || 0),
    status: String(d.status || ''),
    paidAt: typeof d.paidAt === 'string' ? d.paidAt : null,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : null,
    badgeGranted: Boolean(d.badgeGranted),
  }));
}
