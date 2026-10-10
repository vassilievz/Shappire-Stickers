import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

/** Converte o documento Mongo para o JSON de perfil consumido pelo app. */
export function toProfileJson(doc) {
  return {
    uid: doc.firebaseUid,
    email: doc.email,
    displayName: doc.displayName,
    username: doc.username ?? null,
    bio: doc.bio ?? '',
    avatar: doc.avatar ? { ...doc.avatar.toObject() } : null,
    banner: doc.banner ? { ...doc.banner.toObject() } : null,
    badges: Array.isArray(doc.badges) ? [...doc.badges] : [],
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export async function getProfile(uid) {
  const doc = await User.findOne({ firebaseUid: uid });
  return doc ? toProfileJson(doc) : null;
}

/**
 * Cria (se não existir) ou atualiza o perfil do usuário autenticado.
 * O email vem SEMPRE do token Firebase, nunca do corpo (§12).
 * Retorna também imagens substituídas/removidas para limpeza no V0X (§16).
 */
export async function upsertProfile(uid, email, patch) {
  const username = patch.username === undefined ? undefined : patch.username;
  if (username) {
    const taken = await User.findOne({ username, firebaseUid: { $ne: uid } });
    if (taken) {
      throw new ApiError(409, 'USERNAME_TAKEN', 'Este username já está em uso.');
    }
  }

  let doc = await User.findOne({ firebaseUid: uid });
  const created = doc === null;
  if (created) {
    doc = new User({ firebaseUid: uid, email });
  } else {
    doc.email = email;
  }

  const replacedImages = {};
  if (patch.displayName !== undefined) doc.displayName = patch.displayName;
  if (username !== undefined) doc.username = username;
  if (patch.bio !== undefined) doc.bio = patch.bio;

  for (const slot of ['avatar', 'banner']) {
    if (patch[slot] !== undefined && doc[slot] && doc[slot].fileId !== patch[slot]?.fileId) {
      replacedImages[slot] = doc[slot];
    }
    if (patch[slot] !== undefined) {
      doc[slot] = patch[slot];
    }
  }

  await doc.save();
  return { profile: toProfileJson(doc), created, replacedImages };
}

/**
 * Define avatar/banner a partir de metadados V0X. Retorna o perfil atualizado
 * e o metadado anterior (para exclusão best-effort no V0X, §16).
 */
export async function setImage(uid, slot, meta) {
  const doc = await User.findOne({ firebaseUid: uid });
  if (!doc) return null;
  const previous = doc[slot];
  doc[slot] = meta;
  await doc.save();
  return { profile: toProfileJson(doc), previous };
}

/**
 * Concede uma insígnia ao usuário de forma permanente e idempotente ($addToSet).
 */
export async function grantBadge(uid, badgeName) {
  const doc = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { $addToSet: { badges: badgeName } },
    { new: true },
  );
  return doc ? toProfileJson(doc) : null;
}

