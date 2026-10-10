import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  publicationWriteLimiter,
  socialReadLimiter,
} from '../middleware/rateLimit.js';
import { publicationCoverUpload, publicationStickerUpload } from '../middleware/upload.js';
import * as publicationService from '../services/publicationService.js';

export const publicationsRouter = Router();

publicationsRouter.post('/api/publications', requireAuth, publicationWriteLimiter, async (req, res) => {
  const publication = await publicationService.createOrUpdateDraft(req.user.uid, req.body ?? {});
  res.status(201).json(publication);
});

publicationsRouter.patch('/api/publications/:id', requireAuth, publicationWriteLimiter, async (req, res) => {
  const publication = await publicationService.createOrUpdateDraft(req.user.uid, {
    ...req.body,
    publicationId: req.params.id,
  });
  res.json(publication);
});

publicationsRouter.post(
  '/api/publications/:id/stickers/:stickerId',
  requireAuth,
  publicationWriteLimiter,
  publicationStickerUpload.single('file'),
  async (req, res) => {
    let emojis;
    if (req.body?.emojis) {
      try {
        emojis = JSON.parse(req.body.emojis);
      } catch {
        emojis = undefined;
      }
    }
    const meta = {
      fileName: req.body?.fileName,
      emojis,
      accessibilityText: req.body?.accessibilityText,
      width: req.body?.width,
      height: req.body?.height,
      isAnimated: req.body?.isAnimated === 'true',
      durationMs: req.body?.durationMs,
    };
    const publication = await publicationService.uploadStickerAsset(
      req.user.uid,
      req.params.id,
      req.params.stickerId,
      req.file,
      meta,
    );
    res.json(publication);
  },
);

publicationsRouter.post(
  '/api/publications/:id/cover',
  requireAuth,
  publicationWriteLimiter,
  publicationCoverUpload.single('file'),
  async (req, res) => {
    const publication = await publicationService.uploadCover(req.user.uid, req.params.id, req.file);
    res.json(publication);
  },
);

publicationsRouter.post('/api/publications/:id/publish', requireAuth, publicationWriteLimiter, async (req, res) => {
  const publication = await publicationService.publishPublication(req.user.uid, req.params.id);
  res.json(publication);
});

publicationsRouter.post('/api/publications/:id/unpublish', requireAuth, publicationWriteLimiter, async (req, res) => {
  const publication = await publicationService.unpublishPublication(req.user.uid, req.params.id);
  res.json(publication);
});

publicationsRouter.delete('/api/publications/:id', requireAuth, publicationWriteLimiter, async (req, res) => {
  const result = await publicationService.deletePublication(req.user.uid, req.params.id);
  res.json(result);
});

publicationsRouter.get('/api/publications/mine', requireAuth, socialReadLimiter, async (req, res) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? req.query.limit : undefined;
  const page = await publicationService.listOwnerPublications(req.user.uid, req.user.uid, {
    cursor,
    limit,
  });
  res.json(page);
});

publicationsRouter.get('/api/publications/:id', optionalAuth, socialReadLimiter, async (req, res) => {
  const publication = await publicationService.getPublicationById(req.params.id, req.user?.uid ?? null);
  res.json(publication);
});
