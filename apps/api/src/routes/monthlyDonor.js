import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { donationCreateLimiter, donationStatusLimiter, profileReadLimiter } from '../middleware/rateLimit.js';
import * as monthlyDonorPaymentService from '../services/monthlyDonorPaymentService.js';
import * as monthlyDonorService from '../services/monthlyDonorService.js';
import { ApiError } from '../utils/apiError.js';

export const monthlyDonorRouter = Router();

monthlyDonorRouter.get('/api/monthly-donor/status', requireAuth, profileReadLimiter, async (req, res) => {
  const monthlyDonor = await monthlyDonorService.getMonthlyDonorStatusForUid(req.user.uid);
  res.json({ monthlyDonor });
});

monthlyDonorRouter.post('/api/monthly-donor/charges', requireAuth, donationCreateLimiter, async (req, res) => {
  const result = await monthlyDonorPaymentService.createMonthlyDonorCharge({
    uid: req.user.uid,
    email: req.user.email,
  });
  res.status(201).json(result);
});

monthlyDonorRouter.get(
  '/api/monthly-donor/charges/:chargeId/status',
  requireAuth,
  donationStatusLimiter,
  async (req, res) => {
    const { chargeId } = req.params;
    if (!chargeId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Parâmetro chargeId é obrigatório.');
    }
    const result = await monthlyDonorPaymentService.checkMonthlyDonorChargeStatus({
      uid: req.user.uid,
      chargeId,
      email: req.user.email,
    });
    res.json(result);
  },
);
