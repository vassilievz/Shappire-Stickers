import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { profileReadLimiter, profileWriteLimiter } from '../middleware/rateLimit.js';
import * as inviteService from '../services/inviteService.js';
import { ApiError } from '../utils/apiError.js';

export const invitesRouter = Router();

invitesRouter.get('/api/invites/me', requireAuth, profileReadLimiter, async (req, res) => {
  const result = await inviteService.getInviteMe(req.user.uid, req.user.email);
  res.json(result);
});

invitesRouter.get('/api/invites/progress', requireAuth, profileReadLimiter, async (req, res) => {
  const result = await inviteService.getInviteProgress(req.user.uid, req.user.email);
  res.json(result);
});

invitesRouter.post('/api/invites/apply', requireAuth, profileWriteLimiter, async (req, res) => {
  const { code } = req.body ?? {};
  if (!code || typeof code !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campo "code" é obrigatório.');
  }
  const result = await inviteService.applyInviteCode({
    uid: req.user.uid,
    code,
    email: req.user.email,
  });
  res.json(result);
});

invitesRouter.post('/api/invites/redeem', requireAuth, profileWriteLimiter, async (req, res) => {
  const result = await inviteService.redeemInviteReward({
    uid: req.user.uid,
    email: req.user.email,
  });
  res.json(result);
});
