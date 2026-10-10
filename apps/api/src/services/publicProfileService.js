import { normalizeUsername } from '@shappire/contracts';
import { User } from '../models/User.js';
import { Publication } from '../models/Publication.js';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';
import { ApiError } from '../utils/apiError.js';
import { Follow } from '../models/Follow.js';
import { UserBlock } from '../models/UserBlock.js';
import { getFollowState } from './socialInteractionService.js';
import { listOwnerPublications } from './publicationService.js';
import { getBlockedUidSet, toPublicAuthor } from './socialAccessService.js';

export async function getPublicProfileByUsername(username, viewerUid) {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new ApiError(400, 'VALIDATION_ERROR', 'Username inválido.');
  const doc = await User.findOne({ username: normalized }).lean();
  if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Perfil não encontrado.');

  if (viewerUid) {
    const blocked = await getBlockedUidSet(viewerUid);
    if (blocked.has(doc.firebaseUid)) {
      throw new ApiError(404, 'NOT_FOUND', 'Perfil não encontrado.');
    }
  }

  const publicationCount = await Publication.countDocuments({
    ownerUid: doc.firebaseUid,
    visibility: PUBLICATION_VISIBILITY.public,
    status: 'active',
    publishedAt: { $ne: null },
  });

  const followState = await getFollowState(viewerUid, doc.firebaseUid);
  let isBlockedByMe = false;
  if (viewerUid) {
    const block = await UserBlock.findOne({ blockerUid: viewerUid, blockedUid: doc.firebaseUid }).lean();
    isBlockedByMe = Boolean(block);
  }

  return {
    ...toPublicAuthor(doc),
    bio: doc.bio ?? '',
    followerCount: doc.followerCount ?? 0,
    followingCount: doc.followingCount ?? 0,
    publicationCount,
    createdAt: doc.createdAt?.toISOString() ?? null,
    isFollowing: followState.following,
    isBlockedByMe,
  };
}

export async function listUserPublications(username, viewerUid, options) {
  const profile = await getPublicProfileByUsername(username, viewerUid);
  const page = await listOwnerPublications(profile.uid, viewerUid, options);
  return { profile, ...page };
}
