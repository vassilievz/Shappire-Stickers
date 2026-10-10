import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  commentWriteLimiter,
  socialReadLimiter,
  socialWriteLimiter,
} from '../middleware/rateLimit.js';
import * as publicationService from '../services/publicationService.js';
import * as socialInteractionService from '../services/socialInteractionService.js';
import * as publicProfileService from '../services/publicProfileService.js';
import * as moderationService from '../services/moderationService.js';
import {
  acknowledgeAdultEligibility,
  getBlockedUidSet,
  getSocialPreferences,
  updateSocialPreferences,
} from '../services/socialAccessService.js';
import { User } from '../models/User.js';
import { normalizeUsername } from '@shappire/contracts';
import { ApiError } from '../utils/apiError.js';

const USERNAME_SEARCH_MIN = 3;

export const socialRouter = Router();

socialRouter.get('/api/social/preferences', requireAuth, socialReadLimiter, async (req, res) => {
  res.json(await getSocialPreferences(req.user.uid));
});

socialRouter.patch('/api/social/preferences', requireAuth, socialWriteLimiter, async (req, res) => {
  const prefs = await getSocialPreferences(req.user.uid);
  if (req.body?.showAdultContent === true && !prefs.adultContentEligible) {
    throw new ApiError(403, 'ADULT_CONTENT_RESTRICTED', 'Confirme elegibilidade para conteúdo +18.');
  }
  const updated = await updateSocialPreferences(req.user.uid, {
    showAdultContent: req.body?.showAdultContent,
  });
  res.json(updated);
});

socialRouter.post('/api/social/preferences/adult-eligibility', requireAuth, socialWriteLimiter, async (req, res) => {
  if (req.body?.confirmed !== true) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Confirmação de elegibilidade necessária.');
  }
  res.json(await acknowledgeAdultEligibility(req.user.uid));
});

socialRouter.get('/api/social/feed', requireAuth, socialReadLimiter, async (req, res) => {
  const page = await publicationService.getFeed(req.user.uid, {
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.json(page);
});

socialRouter.get('/api/social/explore', optionalAuth, socialReadLimiter, async (req, res) => {
  const page = await publicationService.getExplore(req.user?.uid ?? null, {
    cursor: req.query.cursor,
    limit: req.query.limit,
    sort: req.query.sort,
  });
  res.json(page);
});

socialRouter.get('/api/social/search', optionalAuth, socialReadLimiter, async (req, res) => {
  const publications = await publicationService.searchPublications(req.user?.uid ?? null, {
    q: req.query.q,
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  const term = normalizeUsername(String(req.query.q ?? ''));
  let profiles = { items: [], nextCursor: null };
  if (term.length >= USERNAME_SEARCH_MIN) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blocked = await getBlockedUidSet(req.user?.uid ?? null);
    const blockedList = blocked.size ? [...blocked] : [];
    const users = await User.find({
      username: { $regex: `^${escaped}`, $options: 'i' },
      firebaseUid: blockedList.length ? { $nin: blockedList } : { $exists: true },
    })
      .limit(10)
      .lean();
    profiles.items = users
      .filter((u) => u.username)
      .map((u) => ({
        uid: u.firebaseUid,
        displayName: u.displayName,
        username: u.username,
        avatar: u.avatar ?? null,
        badges: u.badges ?? [],
      }));
  }
  res.json({ publications, profiles });
});

socialRouter.get('/api/social/users/:username', optionalAuth, socialReadLimiter, async (req, res) => {
  const profile = await publicProfileService.getPublicProfileByUsername(
    req.params.username,
    req.user?.uid ?? null,
  );
  res.json(profile);
});

socialRouter.get('/api/social/users/:username/publications', optionalAuth, socialReadLimiter, async (req, res) => {
  const page = await publicProfileService.listUserPublications(req.params.username, req.user?.uid ?? null, {
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.json(page);
});

socialRouter.post('/api/social/users/:uid/follow', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.followUser(req.user.uid, req.params.uid));
});

socialRouter.delete('/api/social/users/:uid/follow', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.unfollowUser(req.user.uid, req.params.uid));
});

socialRouter.get('/api/social/users/:uid/followers', optionalAuth, socialReadLimiter, async (req, res) => {
  res.json(
    await socialInteractionService.listFollowers(req.params.uid, req.user?.uid ?? null, {
      cursor: req.query.cursor,
      limit: req.query.limit,
    }),
  );
});

socialRouter.get('/api/social/users/:uid/following', optionalAuth, socialReadLimiter, async (req, res) => {
  res.json(
    await socialInteractionService.listFollowing(req.params.uid, req.user?.uid ?? null, {
      cursor: req.query.cursor,
      limit: req.query.limit,
    }),
  );
});

socialRouter.post('/api/social/publications/:id/like', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.likePublication(req.user.uid, req.params.id));
});

socialRouter.delete('/api/social/publications/:id/like', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.unlikePublication(req.user.uid, req.params.id));
});

socialRouter.get('/api/social/publications/:id/comments', optionalAuth, socialReadLimiter, async (req, res) => {
  res.json(
    await socialInteractionService.listComments(req.params.id, req.user?.uid ?? null, {
      cursor: req.query.cursor,
      limit: req.query.limit,
    }),
  );
});

socialRouter.post('/api/social/publications/:id/comments', requireAuth, commentWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.createComment(req.user.uid, req.params.id, req.body?.body));
});

socialRouter.patch(
  '/api/social/publications/:id/comments/:commentId',
  requireAuth,
  commentWriteLimiter,
  async (req, res) => {
    res.json(
      await socialInteractionService.updateComment(
        req.user.uid,
        req.params.id,
        req.params.commentId,
        req.body?.body,
      ),
    );
  },
);

socialRouter.delete(
  '/api/social/publications/:id/comments/:commentId',
  requireAuth,
  commentWriteLimiter,
  async (req, res) => {
    res.json(await socialInteractionService.deleteComment(req.user.uid, req.params.id, req.params.commentId));
  },
);

socialRouter.post('/api/social/publications/:id/collect', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await socialInteractionService.collectPublication(req.user.uid, req.params.id));
});

socialRouter.post('/api/social/reports', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await moderationService.createReport(req.user.uid, req.body ?? {}));
});

socialRouter.post('/api/social/users/:uid/block', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await moderationService.blockUser(req.user.uid, req.params.uid));
});

socialRouter.delete('/api/social/users/:uid/block', requireAuth, socialWriteLimiter, async (req, res) => {
  res.json(await moderationService.unblockUser(req.user.uid, req.params.uid));
});
