import mongoose from 'mongoose';
import {
  MAX_ALBUM_DESCRIPTION_LENGTH,
  PUBLICATION_MIN_STICKERS,
  PUBLICATION_MAX_STICKERS,
  PUBLICATION_VISIBILITY,
} from '@shappire/contracts';
import { Publication } from '../models/Publication.js';
import { Like } from '../models/Like.js';
import { CollectionEntry } from '../models/CollectionEntry.js';
import { Follow } from '../models/Follow.js';
import { ApiError } from '../utils/apiError.js';
import { detectImageMimetype } from '../utils/magicBytes.js';
import * as v0xService from './v0xService.js';
import {
  applyPublishedCursor,
  basePublicPublicationFilter,
  canViewAdultContent,
  decodeCursor,
  encodeCursor,
  getBlockedUidSet,
  loadAuthorsByUid,
} from './socialAccessService.js';
import {
  countValidPublicationStickers,
  effectiveStickerCount,
  stickerCountForPersistence,
} from './publicationStickerCount.js';

export { effectiveStickerCount, countValidPublicationStickers } from './publicationStickerCount.js';

const STICKER_MIME = new Set(['image/png', 'image/webp', 'image/gif', 'image/jpeg']);

function sanitizeDescription(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, MAX_ALBUM_DESCRIPTION_LENGTH);
}

function sanitizeTitle(value) {
  const title = String(value ?? '').trim();
  if (!title) throw new ApiError(400, 'VALIDATION_ERROR', 'Título do álbum é obrigatório.');
  return title.slice(0, 128);
}

function toCover(sticker) {
  if (!sticker?.fileId) return null;
  return { fileId: sticker.fileId, url: sticker.url, mimeType: sticker.mimeType };
}

export function toPublicationSummary(doc, extras = {}) {
  return {
    id: String(doc._id),
    ownerUid: doc.ownerUid,
    title: doc.title,
    description: doc.description ?? '',
    cover: doc.cover ? { ...doc.cover } : null,
    stickerCount: effectiveStickerCount(doc),
    visibility: doc.visibility,
    isAdultContent: Boolean(doc.isAdultContent),
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    likeCount: doc.likeCount ?? 0,
    commentCount: doc.commentCount ?? 0,
    collectionCount: doc.collectionCount ?? 0,
    ...extras,
  };
}

export function toPublicationDetail(doc, extras = {}) {
  const stickers = (doc.stickers ?? []).map((s) => ({
    id: s.id,
    fileName: s.fileName,
    fileId: s.fileId,
    url: s.url,
    mimeType: s.mimeType,
    emojis: s.emojis ?? [],
    accessibilityText: s.accessibilityText ?? '',
    width: s.width ?? 0,
    height: s.height ?? 0,
    sizeBytes: s.sizeBytes ?? 0,
    isAnimated: Boolean(s.isAnimated),
    durationMs: s.durationMs,
  }));
  return {
    ...toPublicationSummary(doc, extras),
    stickers,
    localPackId: doc.localPackId ?? null,
  };
}

async function assertOwner(publicationId, uid) {
  if (!mongoose.Types.ObjectId.isValid(publicationId)) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  const doc = await Publication.findById(publicationId);
  if (!doc || doc.status !== 'active') {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  if (doc.ownerUid !== uid) {
    throw new ApiError(403, 'FORBIDDEN', 'Você não pode editar esta publicação.');
  }
  return doc;
}

async function canAccessPublication(doc, viewerUid) {
  if (!doc || doc.status !== 'active') return { allowed: false, reason: 'NOT_FOUND' };
  if (doc.ownerUid === viewerUid) return { allowed: true, owner: true };
  if (doc.visibility !== PUBLICATION_VISIBILITY.public || !doc.publishedAt) {
    return { allowed: false, reason: 'PRIVATE' };
  }
  const allowAdult = await canViewAdultContent(viewerUid);
  if (doc.isAdultContent && !allowAdult) {
    return { allowed: false, reason: 'ADULT' };
  }
  if (viewerUid) {
    const blocked = await getBlockedUidSet(viewerUid);
    if (blocked.has(doc.ownerUid)) return { allowed: false, reason: 'BLOCKED' };
  }
  return { allowed: true, owner: false };
}

async function enrichSummaries(items, viewerUid) {
  if (!items.length) return [];
  const pubIds = items.map((i) => i._id);
  const authorMap = await loadAuthorsByUid(items.map((i) => i.ownerUid));
  let liked = new Set();
  let collected = new Set();
  if (viewerUid) {
    const [likes, collections] = await Promise.all([
      Like.find({ userUid: viewerUid, publicationId: { $in: pubIds } }).lean(),
      CollectionEntry.find({ userUid: viewerUid, publicationId: { $in: pubIds } }).lean(),
    ]);
    liked = new Set(likes.map((l) => String(l.publicationId)));
    collected = new Set(collections.map((c) => String(c.publicationId)));
  }
  return items.map((doc) =>
    toPublicationSummary(doc, {
      author: authorMap.get(doc.ownerUid) ?? null,
      likedByMe: liked.has(String(doc._id)),
      collectedByMe: collected.has(String(doc._id)),
    }),
  );
}

export async function createOrUpdateDraft(uid, input) {
  const title = sanitizeTitle(input.title);
  const description = sanitizeDescription(input.description);
  const localPackId = typeof input.localPackId === 'string' ? input.localPackId : null;
  const isAdultContent = Boolean(input.isAdultContent);
  const visibility =
    input.visibility === PUBLICATION_VISIBILITY.public
      ? PUBLICATION_VISIBILITY.public
      : PUBLICATION_VISIBILITY.private;

  let doc = null;
  if (localPackId) {
    doc = await Publication.findOne({ ownerUid: uid, localPackId });
  }
  if (!doc && input.publicationId && mongoose.Types.ObjectId.isValid(input.publicationId)) {
    doc = await Publication.findOne({ _id: input.publicationId, ownerUid: uid });
  }

  if (!doc) {
    doc = new Publication({
      ownerUid: uid,
      localPackId,
      title,
      description,
      visibility: PUBLICATION_VISIBILITY.private,
      isAdultContent,
      publishedAt: null,
    });
  } else {
    doc.title = title;
    doc.description = description;
    doc.isAdultContent = isAdultContent;
    if (visibility === PUBLICATION_VISIBILITY.private) {
      doc.visibility = PUBLICATION_VISIBILITY.private;
      doc.publishedAt = null;
    }
    if (localPackId) doc.localPackId = localPackId;
  }

  await doc.save();
  return toPublicationDetail(doc);
}

export async function uploadStickerAsset(uid, publicationId, stickerId, file, meta) {
  const doc = await assertOwner(publicationId, uid);
  if (!file?.buffer?.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Arquivo não enviado.');
  }
  const mime = detectImageMimetype(file.buffer);
  if (!mime || !STICKER_MIME.has(mime)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formato de figurinha não suportado.');
  }
  const id = String(stickerId ?? '').trim();
  if (!id) throw new ApiError(400, 'VALIDATION_ERROR', 'ID da figurinha inválido.');
  if (doc.stickers.length >= PUBLICATION_MAX_STICKERS) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Limite de figurinhas atingido.');
  }

  const hosted = await v0xService.uploadFile(file.buffer, file.originalname || `${id}.webp`, mime);
  const sticker = {
    id,
    fileName: String(meta?.fileName ?? file.originalname ?? `${id}.webp`),
    fileId: hosted.fileId,
    url: hosted.url,
    mimeType: hosted.mimeType,
    emojis: Array.isArray(meta?.emojis) ? meta.emojis.slice(0, 3) : [],
    accessibilityText: String(meta?.accessibilityText ?? '').slice(0, 125),
    width: Number(meta?.width) || 0,
    height: Number(meta?.height) || 0,
    sizeBytes: file.buffer.length,
    isAnimated: Boolean(meta?.isAnimated),
    durationMs: meta?.durationMs ? Number(meta.durationMs) : undefined,
  };

  const index = doc.stickers.findIndex((s) => s.id === id);
  if (index >= 0) doc.stickers[index] = sticker;
  else doc.stickers.push(sticker);

  if (!doc.cover) doc.cover = toCover(sticker);
  doc.stickerCount = stickerCountForPersistence(doc);
  await doc.save();
  return toPublicationDetail(doc);
}

const PUBLICATION_LIST_SELECT =
  'ownerUid localPackId title description cover visibility isAdultContent publishedAt likeCount commentCount collectionCount status updatedAt stickerCount';

export async function uploadCover(uid, publicationId, file) {
  const doc = await assertOwner(publicationId, uid);
  if (!file?.buffer?.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Arquivo não enviado.');
  }
  const mime = detectImageMimetype(file.buffer);
  if (!mime || !STICKER_MIME.has(mime)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formato de capa não suportado.');
  }
  const hosted = await v0xService.uploadFile(file.buffer, file.originalname || 'cover.webp', mime);
  doc.cover = { fileId: hosted.fileId, url: hosted.url, mimeType: hosted.mimeType };
  await doc.save();
  return toPublicationDetail(doc);
}

export async function publishPublication(uid, publicationId) {
  const doc = await assertOwner(publicationId, uid);
  doc.stickerCount = stickerCountForPersistence(doc);
  if (countValidPublicationStickers(doc.stickers) < PUBLICATION_MIN_STICKERS) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Publicação exige ao menos ${PUBLICATION_MIN_STICKERS} figurinhas.`);
  }
  doc.visibility = PUBLICATION_VISIBILITY.public;
  doc.publishedAt = doc.publishedAt ?? new Date();
  await doc.save();
  return toPublicationDetail(doc);
}

export async function unpublishPublication(uid, publicationId) {
  const doc = await assertOwner(publicationId, uid);
  doc.visibility = PUBLICATION_VISIBILITY.private;
  doc.publishedAt = null;
  await doc.save();
  return toPublicationDetail(doc);
}

export async function deletePublication(uid, publicationId) {
  if (!mongoose.Types.ObjectId.isValid(publicationId)) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  const doc = await Publication.findById(publicationId);
  if (!doc) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  if (doc.ownerUid !== uid) {
    throw new ApiError(403, 'FORBIDDEN', 'Você não pode editar esta publicação.');
  }
  if (doc.status === 'removed') {
    return { ok: true };
  }
  doc.status = 'removed';
  doc.visibility = PUBLICATION_VISIBILITY.private;
  doc.publishedAt = null;
  await doc.save();
  return { ok: true };
}

export async function getPublicationById(publicationId, viewerUid) {
  if (!mongoose.Types.ObjectId.isValid(publicationId)) {
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  const doc = await Publication.findById(publicationId);
  const access = await canAccessPublication(doc, viewerUid);
  if (!access.allowed) {
    if (access.reason === 'ADULT') {
      throw new ApiError(403, 'ADULT_CONTENT_RESTRICTED', 'Conteúdo +18 não disponível com suas preferências.');
    }
    throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Publicação não encontrada.');
  }
  const [enriched] = await enrichSummaries([doc], viewerUid);
  return toPublicationDetail(doc, {
    author: enriched.author,
    likedByMe: enriched.likedByMe,
    collectedByMe: enriched.collectedByMe,
  });
}

export async function listOwnerPublications(ownerUid, viewerUid, { cursor, limit = 20 } = {}) {
  const allowAdult = await canViewAdultContent(viewerUid);
  const blocked = await getBlockedUidSet(viewerUid);
  const isOwner = viewerUid === ownerUid;
  const filter = isOwner
    ? { ownerUid, status: 'active' }
    : basePublicPublicationFilter(viewerUid, { allowAdult, blockedUids: blocked });
  if (!isOwner) filter.ownerUid = ownerUid;

  let query = { ...filter };
  if (!isOwner) query = applyPublishedCursor(query, cursor);
  else if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const docs = await Publication.find(query)
    .select(PUBLICATION_LIST_SELECT)
    .sort(isOwner ? { updatedAt: -1, _id: -1 } : { publishedAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const slice = hasMore ? docs.slice(0, pageSize) : docs;
  const items = await enrichSummaries(slice, viewerUid);
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last
      ? isOwner
        ? String(last._id)
        : encodeCursor(last.publishedAt, last._id)
      : null;
  return { items, nextCursor };
}

export async function getFeed(viewerUid, { cursor, limit = 20 } = {}) {
  if (!viewerUid) throw new ApiError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  const following = await Follow.find({ followerUid: viewerUid }).select('followingUid').lean();
  const followingUids = following.map((f) => f.followingUid);
  if (!followingUids.length) return { items: [], nextCursor: null };

  const allowAdult = await canViewAdultContent(viewerUid);
  const blocked = await getBlockedUidSet(viewerUid);
  let query = {
    ...basePublicPublicationFilter(viewerUid, { allowAdult, blockedUids: blocked }),
    ownerUid: { $in: followingUids },
  };
  query = applyPublishedCursor(query, cursor);

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const docs = await Publication.find(query)
    .select(PUBLICATION_LIST_SELECT)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();
  const hasMore = docs.length > pageSize;
  const slice = hasMore ? docs.slice(0, pageSize) : docs;
  const items = await enrichSummaries(slice, viewerUid);
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.publishedAt, last._id) : null;
  return { items, nextCursor };
}

export async function getExplore(viewerUid, { cursor, limit = 20, sort = 'recent' } = {}) {
  const allowAdult = await canViewAdultContent(viewerUid);
  const blocked = await getBlockedUidSet(viewerUid);
  let query = basePublicPublicationFilter(viewerUid, { allowAdult, blockedUids: blocked });

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 50);
  let sortSpec = { publishedAt: -1, _id: -1 };
  if (sort === 'likes') sortSpec = { likeCount: -1, _id: -1 };
  if (sort === 'collections') sortSpec = { collectionCount: -1, _id: -1 };

  if (sort === 'recent') {
    query = applyPublishedCursor(query, cursor);
  } else if (cursor) {
    const decoded = decodeExploreCursor(cursor, sort);
    if (decoded) {
      query = { ...query, ...decoded.filter };
    }
  }

  const docs = await Publication.find(query)
    .select(PUBLICATION_LIST_SELECT)
    .sort(sortSpec)
    .limit(pageSize + 1)
    .lean();
  const hasMore = docs.length > pageSize;
  const slice = hasMore ? docs.slice(0, pageSize) : docs;
  const items = await enrichSummaries(slice, viewerUid);
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? encodeExploreCursor(last, sort) : null;
  return { items, nextCursor };
}

function encodeExploreCursor(doc, sort) {
  if (sort === 'likes') {
    return Buffer.from(JSON.stringify({ k: 'likes', v: doc.likeCount, id: String(doc._id) }), 'utf8').toString(
      'base64url',
    );
  }
  if (sort === 'collections') {
    return Buffer.from(
      JSON.stringify({ k: 'collections', v: doc.collectionCount, id: String(doc._id) }),
      'utf8',
    ).toString('base64url');
  }
  return encodeCursor(doc.publishedAt, doc._id);
}

function decodeExploreCursor(cursor, sort) {
  if (sort === 'recent') {
    const decoded = decodeCursor(cursor);
    if (!decoded) return null;
    return {
      filter: {
        $or: [
          { publishedAt: { $lt: decoded.publishedAt } },
          { publishedAt: decoded.publishedAt, _id: { $lt: decoded.id } },
        ],
      },
    };
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed?.id || !mongoose.Types.ObjectId.isValid(parsed.id)) return null;
    const id = new mongoose.Types.ObjectId(parsed.id);
    const field = sort === 'likes' ? 'likeCount' : 'collectionCount';
    const value = Number(parsed.v);
    return {
      filter: {
        $or: [{ [field]: { $lt: value } }, { [field]: value, _id: { $lt: id } }],
      },
    };
  } catch {
    return null;
  }
}

export async function searchPublications(viewerUid, { q, cursor, limit = 20 } = {}) {
  const term = String(q ?? '').trim().slice(0, 80);
  if (term.length < 2) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Termo de busca muito curto.');
  }
  const allowAdult = await canViewAdultContent(viewerUid);
  const blocked = await getBlockedUidSet(viewerUid);
  const filter = {
    ...basePublicPublicationFilter(viewerUid, { allowAdult, blockedUids: blocked }),
    $text: { $search: term },
  };
  let query = applyPublishedCursor(filter, cursor);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const docs = await Publication.find(query, { score: { $meta: 'textScore' } })
    .select(PUBLICATION_LIST_SELECT)
    .sort({ score: { $meta: 'textScore' }, publishedAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();
  const hasMore = docs.length > pageSize;
  const slice = hasMore ? docs.slice(0, pageSize) : docs;
  const items = await enrichSummaries(slice, viewerUid);
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.publishedAt, last._id) : null;
  return { items, nextCursor };
}
