import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { donationCreateLimiter, donationStatusLimiter, profileReadLimiter } from '../middleware/rateLimit.js';
import * as donationService from '../services/donationService.js';
import { ApiError } from '../utils/apiError.js';

export const donationRouter = Router();

/**
 * Cria cobrança PIX para apoio voluntário ao Shappire Stickers.
 */
donationRouter.post('/api/donations', requireAuth, donationCreateLimiter, async (req, res) => {
  const { amount } = req.body ?? {};
  if (amount === undefined || amount === null) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campo "amount" é obrigatório.');
  }

  const result = await donationService.createDonation({
    uid: req.user.uid,
    amount,
  });

  res.status(201).json(result);
});

/**
 * Consulta status da cobrança PIX (polling seguro com cooldown e rate limiting).
 */
donationRouter.get(
  '/api/donations/:donationId/status',
  requireAuth,
  donationStatusLimiter,
  async (req, res) => {
    const { donationId } = req.params;
    if (!donationId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Parâmetro donationId é obrigatório.');
    }

    const result = await donationService.checkDonationStatus({
      uid: req.user.uid,
      donationId,
    });

    res.json(result);
  },
);

/**
 * Retorna doações do usuário logado.
 */
donationRouter.get('/api/donations/me', requireAuth, profileReadLimiter, async (req, res) => {
  const donations = await donationService.getUserDonations(req.user.uid);
  res.json({ donations });
});
