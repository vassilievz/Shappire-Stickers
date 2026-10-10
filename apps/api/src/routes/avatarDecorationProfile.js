import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { profileWriteLimiter } from '../middleware/rateLimit.js';
import * as avatarDecorationService from '../services/avatarDecorationService.js';
import * as userService from '../services/userService.js';
import { ApiError } from '../utils/apiError.js';

export const avatarDecorationProfileRouter = Router();

avatarDecorationProfileRouter.patch(
  '/api/profile/avatar-decoration',
  requireAuth,
  profileWriteLimiter,
  async (req, res) => {
    const { decorationId } = req.body ?? {};
    if (!decorationId || typeof decorationId !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Campo "decorationId" é obrigatório.');
    }
    await avatarDecorationService.setAvatarDecoration({
      uid: req.user.uid,
      decorationId,
    });
    const profile = await userService.getProfile(req.user.uid);
    res.json(profile);
  },
);

avatarDecorationProfileRouter.delete(
  '/api/profile/avatar-decoration',
  requireAuth,
  profileWriteLimiter,
  async (req, res) => {
    await avatarDecorationService.clearAvatarDecoration({ uid: req.user.uid });
    const profile = await userService.getProfile(req.user.uid);
    res.json(profile);
  },
);
