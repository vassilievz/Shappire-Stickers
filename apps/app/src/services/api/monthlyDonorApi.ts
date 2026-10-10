import { API_ROUTES, type MonthlyDonorChargeCreateResponse, type MonthlyDonorChargeStatusResponse, type MonthlyDonorStatus } from '@shappire/contracts';
import { apiRequest } from './client';

export async function fetchMonthlyDonorStatus(): Promise<{ monthlyDonor: MonthlyDonorStatus }> {
  const res = await apiRequest(API_ROUTES.monthlyDonorStatus);
  return res.body as { monthlyDonor: MonthlyDonorStatus };
}

export async function createMonthlyDonorCharge(): Promise<MonthlyDonorChargeCreateResponse> {
  const res = await apiRequest(API_ROUTES.monthlyDonorCharges, { method: 'POST', body: '{}' });
  return res.body as MonthlyDonorChargeCreateResponse;
}

export async function getMonthlyDonorChargeStatus(chargeId: string): Promise<MonthlyDonorChargeStatusResponse> {
  const res = await apiRequest(API_ROUTES.monthlyDonorChargeStatus(chargeId));
  return res.body as MonthlyDonorChargeStatusResponse;
}
