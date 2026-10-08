import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { imageUploadLimiter, profileReadLimiter, profileWriteLimiter } from '../middleware/rateLimit.js';
import { avatarUpload, bannerUpload } from '../middleware/upload.js';
import { ApiError } from '../utils/apiError.js';
import * as profileService from '../services/profileService.js';

export const profileRouter = Router();

/**
 * Todas as rotas operam SOMENTE sobre o próprio perfil (req.user.uid do token).
 * Não existe parâmetro de id em nenhuma rota — não há como tocar perfil de
 * outro usuário (§24).
 */
profileRouter.get('/api/profile', requireAuth, profileReadLimiter, async (req, res) => {
  const profile = await profileService.getProfile(req.user.uid);
  res.json(profile);
});

profileRouter.patch('/api/profile', requireAuth, profileWriteLimiter, async (req, res) => {
  const profile = await profileService.updateProfile(req.user.uid, req.user.email, req.body);
  res.json(profile);
});

function buildImageHandler(slot) {
  return async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Arquivo não enviado (campo "file").');
    }
    const profile = await profileService.uploadProfileImage(req.user.uid, slot, req.file);
    res.json(profile);
  };
}

profileRouter.post('/api/profile/avatar', requireAuth, imageUploadLimiter, avatarUpload.single('file'), buildImageHandler('avatar'));
profileRouter.post('/api/profile/banner', requireAuth, imageUploadLimiter, bannerUpload.single('file'), buildImageHandler('banner'));
