import {
  API_ROUTES,
  type InviteApplyResponse,
  type InviteMeResponse,
  type InviteProgressResponse,
  type InviteRedeemResponse,
} from '@shappire/contracts';
import { apiRequest } from './client';

export async function fetchInviteMe(): Promise<InviteMeResponse> {
  const res = await apiRequest(API_ROUTES.invitesMe);
  return res.body as InviteMeResponse;
}

export async function fetchInviteProgress(): Promise<InviteProgressResponse> {
  const res = await apiRequest(API_ROUTES.invitesProgress);
  return res.body as InviteProgressResponse;
}

export async function applyInviteCode(code: string): Promise<InviteApplyResponse> {
  const res = await apiRequest(API_ROUTES.invitesApply, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return res.body as InviteApplyResponse;
}

export async function redeemInviteReward(): Promise<InviteRedeemResponse> {
  const res = await apiRequest(API_ROUTES.invitesRedeem, { method: 'POST', body: '{}' });
  return res.body as InviteRedeemResponse;
}
