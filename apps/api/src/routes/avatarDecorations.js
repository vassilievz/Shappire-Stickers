import { Router } from 'express';
import { profileReadLimiter } from '../middleware/rateLimit.js';
import { getCatalogResponse } from '../services/avatarDecorationCatalog.js';

export const avatarDecorationsRouter = Router();

avatarDecorationsRouter.get('/api/avatar-decorations/catalog', profileReadLimiter, (_req, res) => {
  res.json(getCatalogResponse());
});
