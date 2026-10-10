import { Router } from 'express';
import { profileReadLimiter } from '../middleware/rateLimit.js';
import { getAppReleasePayload } from '../services/appRelease.js';

export const appReleaseRouter = Router();

appReleaseRouter.get('/api/app/release', profileReadLimiter, (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getAppReleasePayload());
});
