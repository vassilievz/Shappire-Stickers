import mongoose from 'mongoose';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';
import { User } from '../models/User.js';
import { UserBlock } from '../models/UserBlock.js';
import { ApiError } from '../utils/apiError.js';
import { resolvePublicAvatarDecoration } from './avatarDecorationService.js';

export async function getSocialPreferences(uid) {
  const doc = await User.findOne({ firebaseUid: uid }).select('preferences');
  const prefs = doc?.preferences ?? {};
  return {
    showAdultContent: Boolean(prefs.showAdultContent),
    adultContentEligible: Boolean(prefs.adultContentEligible),
  };
}

export async function updateSocialPreferences(uid, patch) {
  const update = {};
  if (patch.showAdultContent !== undefined) {
    update['preferences.showAdultContent'] = Boolean(patch.showAdultContent);
  }
  if (patch.adultContentEligible !== undefined) {
    update['preferences.adultContentEligible'] = Boolean(patch.adultContentEligible);
  }
  const doc = await User.findOneAndUpdate({ firebaseUid: uid }, { $set: update }, { new: true });
  if (!doc) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }
  return getSocialPreferences(uid);
}

export async function acknowledgeAdultEligibility(uid) {
  if (process.env.ADULT_CONTENT_SELF_ATTESTATION !== 'true') {
    throw new ApiError(
      403,
      'ADULT_CONTENT_RESTRICTED',
      'Elegibilidade para conteúdo +18 não está disponível neste ambiente.',
    );
  }
  const doc = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { $set: { 'preferences.adultContentEligible': true } },
    { new: true },
  );
  if (!doc) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }
  return getSocialPreferences(uid);
}

export async function canViewAdultContent(viewerUid) {
  if (!viewerUid) return false;
  const prefs = await getSocialPreferences(viewerUid);
  return prefs.adultContentEligible && prefs.showAdultContent;
}

export function adultContentMongoFilter(allowAdult) {
  if (allowAdult) return {};
  return { isAdultContent: { $ne: true } };
}

export async function getBlockedUidSet(viewerUid) {
  if (!viewerUid) return new Set();
  const rows = await UserBlock.find({
    $or: [{ blockerUid: viewerUid }, { blockedUid: viewerUid }],
  }).lean();
  const set = new Set();
  for (const row of rows) {
    if (row.blockerUid === viewerUid) set.add(row.blockedUid);
    if (row.blockedUid === viewerUid) set.add(row.blockerUid);
  }
  return set;
}

export async function assertInteractionAllowed(actorUid, targetUid) {
  if (!actorUid || !targetUid || actorUid === targetUid) return;
  const blocked = await UserBlock.findOne({
    $or: [
      { blockerUid: actorUid, blockedUid: targetUid },
      { blockerUid: targetUid, blockedUid: actorUid },
    ],
  }).lean();
  if (blocked) {
    throw new ApiError(403, 'BLOCKED', 'Interação bloqueada entre estes usuários.');
  }
}

export function toPublicAuthor(doc) {
  if (!doc) return null;
  const decoration = resolvePublicAvatarDecoration(doc);
  return {
    uid: doc.firebaseUid,
    displayName: doc.displayName,
    username: doc.username ?? null,
    avatar: doc.avatar ? { ...doc.avatar } : null,
    badges: Array.isArray(doc.badges) ? [...doc.badges] : [],
    avatarDecoration: decoration,
  };
}

export async function loadAuthorsByUid(uids) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ firebaseUid: { $in: unique } })
    .select('firebaseUid displayName username avatar badges avatarDecorationId monthlyDonorExpiresAt')
    .lean();
  const map = new Map();
  for (const user of users) {
    map.set(user.firebaseUid, toPublicAuthor(user));
  }
  return map;
}

export function basePublicPublicationFilter(viewerUid, { allowAdult, blockedUids }) {
  const ownerExclusions = blockedUids?.size ? { ownerUid: { $nin: [...blockedUids] } } : {};
  return {
    visibility: PUBLICATION_VISIBILITY.public,
    status: 'active',
    publishedAt: { $ne: null },
    ...adultContentMongoFilter(allowAdult),
    ...ownerExclusions,
  };
}

export function encodeCursor(publishedAt, id) {
  const payload = JSON.stringify({
    t: publishedAt instanceof Date ? publishedAt.toISOString() : publishedAt,
    id: String(id),
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed?.t || !parsed?.id) return null;
    const date = new Date(parsed.t);
    if (Number.isNaN(date.getTime())) return null;
    if (!mongoose.Types.ObjectId.isValid(parsed.id)) return null;
    return { publishedAt: date, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
}

export function applyPublishedCursor(query, cursor) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return query;
  return {
    ...query,
    $or: [
      { publishedAt: { $lt: decoded.publishedAt } },
      { publishedAt: decoded.publishedAt, _id: { $lt: decoded.id } },
    ],
  };
}
