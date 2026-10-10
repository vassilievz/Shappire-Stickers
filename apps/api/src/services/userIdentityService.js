import crypto from 'node:crypto';
import { INVITE_CODE_LENGTH, MAX_DISPLAY_NAME_LENGTH } from '@shappire/contracts';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

function defaultDisplayNameFromEmail(email) {
  const local = typeof email === 'string' ? email.split('@')[0]?.trim() : '';
  const base = local || 'Usuário';
  return base.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

function resolveAccountEmail(uid, email, existingDoc) {
  if (typeof email === 'string' && email.trim()) return email.trim();
  if (existingDoc?.email) return existingDoc.email;
  return `${uid}@account.shappire.local`;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomPublicId() {
  return crypto.randomBytes(12).toString('hex');
}

function randomInviteCode() {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

/**
 * Garante publicId e inviteCode únicos no documento do usuário.
 * Idempotente — não altera valores já existentes.
 */
/**
 * Garante documento Mongo para o uid autenticado (ex.: login Google sem PATCH de perfil).
 * Idempotente; preenche publicId/inviteCode via ensureUserIdentity.
 */
export async function ensureUserRecord(uid, email = null) {
  if (!uid) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Identificador de usuário ausente.');
  }
  let doc = await User.findOne({ firebaseUid: uid });
  const resolvedEmail = resolveAccountEmail(uid, email, doc);

  if (!doc) {
    doc = new User({
      firebaseUid: uid,
      email: resolvedEmail,
      displayName: defaultDisplayNameFromEmail(resolvedEmail),
    });
    await doc.save();
  } else if (typeof email === 'string' && email.trim() && doc.email !== email.trim()) {
    doc.email = email.trim();
    await doc.save();
  }

  return ensureUserIdentity(doc);
}

export async function ensureUserIdentity(doc) {
  if (!doc) return doc;
  let changed = false;
  if (!doc.publicId) {
    doc.publicId = randomPublicId();
    changed = true;
  }
  if (!doc.inviteCode) {
    let attempts = 0;
    while (attempts < 8) {
      const candidate = randomInviteCode();
      const exists = await User.exists({ inviteCode: candidate });
      if (!exists) {
        doc.inviteCode = candidate;
        changed = true;
        break;
      }
      attempts += 1;
    }
    if (!doc.inviteCode) {
      doc.inviteCode = randomInviteCode() + crypto.randomBytes(2).toString('hex').slice(0, 2);
      changed = true;
    }
  }
  if (changed) {
    await doc.save();
  }
  return doc;
}

export async function findUserByInviteCode(normalizedCode) {
  return User.findOne({ inviteCode: normalizedCode });
}

export function normalizeInviteCodeInput(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
