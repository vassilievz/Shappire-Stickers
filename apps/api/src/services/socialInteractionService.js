import mongoose from 'mongoose';
import { MAX_COMMENT_LENGTH, PUBLICATION_VISIBILITY } from '@shappire/contracts';
import { Follow } from '../models/Follow.js';
import { Like } from '../models/Like.js';
import { Comment } from '../models/Comment.js';
import { CollectionEntry } from '../models/CollectionEntry.js';
import { Publication } from '../models/Publication.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import {
  assertInteractionAllowed,
  canViewAdultContent,
  getBlockedUidSet,
  loadAuthorsByUid,
  toPublicAuthor,
} from './socialAccessService.js';
import { getPublicationById } from './publicationService.js';

function sanitizeCommentBody(body) {
  const text = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) throw new ApiError(400, 'VALIDATION_ERROR', 'Comentário vazio.');
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Comentário muito longo.');
  }
  return text;
}

async function getPublicPublication(publicationId, viewerUid) {
  if (!mongoose.Types.ObjectId.isValid(publicationId)) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  const doc = await Publication.findById(publicationId);
  if (!doc || doc.status !== 'active') {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  if (doc.visibility !== PUBLICATION_VISIBILITY.public || !doc.publishedAt) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  if (doc.isAdultContent && !(await canViewAdultContent(viewerUid))) {
    throw new ApiError(403, 'ADULT_CONTENT_RESTRICTED', 'Conteúdo +18 não disponível.');
  }
  if (viewerUid) {
    const blocked = await getBlockedUidSet(viewerUid);
    if (blocked.has(doc.ownerUid)) {
      throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
    }
    await assertInteractionAllowed(viewerUid, doc.ownerUid);
  }
  return doc;
}

export async function followUser(followerUid, followingUid) {
  if (followerUid === followingUid) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Você não pode seguir a si mesmo.');
  }
  await assertInteractionAllowed(followerUid, followingUid);
  const target = await User.findOne({ firebaseUid: followingUid });
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');

  const existing = await Follow.findOne({ followerUid, followingUid });
  if (existing) return { following: true };

  try {
    await Follow.create({ followerUid, followingUid });
    await Promise.all([
      User.updateOne({ firebaseUid: followerUid }, { $inc: { followingCount: 1 } }),
      User.updateOne({ firebaseUid: followingUid }, { $inc: { followerCount: 1 } }),
    ]);
  } catch (error) {
    if (error?.code === 11000) return { following: true };
    throw error;
  }
  return { following: true };
}

export async function unfollowUser(followerUid, followingUid) {
  const removed = await Follow.findOneAndDelete({ followerUid, followingUid });
  if (!removed) return { following: false };
  await Promise.all([
    User.updateOne({ firebaseUid: followerUid }, { $inc: { followingCount: -1 } }),
    User.updateOne({ firebaseUid: followingUid }, { $inc: { followerCount: -1 } }),
  ]);
  return { following: false };
}

export async function getFollowState(viewerUid, targetUid) {
  if (!viewerUid || viewerUid === targetUid) return { following: false };
  const row = await Follow.findOne({ followerUid: viewerUid, followingUid: targetUid }).lean();
  return { following: Boolean(row) };
}

export async function listFollowers(targetUid, viewerUid, { cursor, limit = 30 } = {}) {
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const filter = { followingUid: targetUid };
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const rows = await Follow.find(filter).sort({ _id: -1 }).limit(pageSize + 1).lean();
  const hasMore = rows.length > pageSize;
  const slice = hasMore ? rows.slice(0, pageSize) : rows;
  const blocked = await getBlockedUidSet(viewerUid);
  const uids = slice.map((r) => r.followerUid).filter((uid) => !blocked.has(uid));
  const authors = await loadAuthorsByUid(uids);
  const items = uids.map((uid) => authors.get(uid)).filter(Boolean);
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;
  return { items, nextCursor };
}

export async function listFollowing(targetUid, viewerUid, { cursor, limit = 30 } = {}) {
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const filter = { followerUid: targetUid };
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const rows = await Follow.find(filter).sort({ _id: -1 }).limit(pageSize + 1).lean();
  const hasMore = rows.length > pageSize;
  const slice = hasMore ? rows.slice(0, pageSize) : rows;
  const blocked = await getBlockedUidSet(viewerUid);
  const uids = slice.map((r) => r.followingUid).filter((uid) => !blocked.has(uid));
  const authors = await loadAuthorsByUid(uids);
  const items = uids.map((uid) => authors.get(uid)).filter(Boolean);
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;
  return { items, nextCursor };
}

export async function likePublication(userUid, publicationId) {
  const pub = await getPublicPublication(publicationId, userUid);
  await assertInteractionAllowed(userUid, pub.ownerUid);
  try {
    await Like.create({ userUid, publicationId: pub._id });
    await Publication.updateOne({ _id: pub._id }, { $inc: { likeCount: 1 } });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const updated = await Publication.findById(pub._id).lean();
  return { liked: true, likeCount: updated?.likeCount ?? pub.likeCount };
}

export async function unlikePublication(userUid, publicationId) {
  const pub = await getPublicPublication(publicationId, userUid);
  const removed = await Like.findOneAndDelete({ userUid, publicationId: pub._id });
  if (removed) {
    await Publication.updateOne({ _id: pub._id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
  }
  const updated = await Publication.findById(pub._id).lean();
  return { liked: false, likeCount: updated?.likeCount ?? pub.likeCount };
}

export async function listComments(publicationId, viewerUid, { cursor, limit = 30 } = {}) {
  await getPublicPublication(publicationId, viewerUid);
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const filter = {
    publicationId,
    moderationStatus: 'visible',
    deletedAt: null,
  };
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const blocked = await getBlockedUidSet(viewerUid);
  const docs = await Comment.find(filter).sort({ _id: -1 }).limit(pageSize + 1).lean();
  const hasMore = docs.length > pageSize;
  const slice = hasMore ? docs.slice(0, pageSize) : docs;
  const visible = slice.filter((c) => !blocked.has(c.authorUid));
  const authors = await loadAuthorsByUid(visible.map((c) => c.authorUid));
  const items = visible.map((c) => ({
    id: String(c._id),
    body: c.body,
    createdAt: c.createdAt?.toISOString() ?? null,
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
    author: authors.get(c.authorUid) ?? { uid: c.authorUid, displayName: 'Usuário', username: null, avatar: null, badges: [] },
  }));
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;
  return { items, nextCursor };
}

export async function createComment(userUid, publicationId, body) {
  const pub = await getPublicPublication(publicationId, userUid);
  await assertInteractionAllowed(userUid, pub.ownerUid);
  const text = sanitizeCommentBody(body);
  const doc = await Comment.create({
    publicationId: pub._id,
    authorUid: userUid,
    body: text,
  });
  await Publication.updateOne({ _id: pub._id }, { $inc: { commentCount: 1 } });
  const authorDoc = await User.findOne({ firebaseUid: userUid }).lean();
  return {
    id: String(doc._id),
    body: doc.body,
    createdAt: doc.createdAt?.toISOString() ?? null,
    editedAt: null,
    author: toPublicAuthor(authorDoc),
  };
}

export async function updateComment(userUid, publicationId, commentId, body) {
  await getPublicPublication(publicationId, userUid);
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comentário não encontrado.');
  }
  const text = sanitizeCommentBody(body);
  const doc = await Comment.findOne({ _id: commentId, publicationId, authorUid: userUid, deletedAt: null });
  if (!doc) throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comentário não encontrado.');
  doc.body = text;
  doc.editedAt = new Date();
  await doc.save();
  const authorDoc = await User.findOne({ firebaseUid: userUid }).lean();
  return {
    id: String(doc._id),
    body: doc.body,
    createdAt: doc.createdAt?.toISOString() ?? null,
    editedAt: doc.editedAt.toISOString(),
    author: toPublicAuthor(authorDoc),
  };
}

export async function deleteComment(userUid, publicationId, commentId) {
  await getPublicPublication(publicationId, userUid);
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comentário não encontrado.');
  }
  const doc = await Comment.findOne({ _id: commentId, publicationId, authorUid: userUid, deletedAt: null });
  if (!doc) throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comentário não encontrado.');
  doc.deletedAt = new Date();
  doc.moderationStatus = 'removed';
  await doc.save();
  await Publication.updateOne({ _id: publicationId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  return { ok: true };
}

export async function collectPublication(userUid, publicationId) {
  const detail = await getPublicationById(publicationId, userUid);
  await assertInteractionAllowed(userUid, detail.ownerUid);
  try {
    await CollectionEntry.create({
      userUid,
      publicationId,
      sourceOwnerUid: detail.ownerUid,
    });
    await Publication.updateOne({ _id: publicationId }, { $inc: { collectionCount: 1 } });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'ALREADY_COLLECTED', 'Álbum já está na sua coleção.');
    }
    throw error;
  }
  const updated = await Publication.findById(publicationId).lean();
  return {
    collected: true,
    collectionCount: updated?.collectionCount ?? detail.collectionCount + 1,
    publication: detail,
  };
}
