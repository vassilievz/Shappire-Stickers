import path from 'node:path';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  normalizeUsername,
} from '@shappire/contracts';
import { ApiError } from '../utils/apiError.js';
import { detectImageMimetype } from '../utils/magicBytes.js';
import * as userService from './userService.js';
import * as v0xService from './v0xService.js';

const PATCHABLE_FIELDS = ['displayName', 'username', 'bio', 'avatar', 'banner'];
const IMAGE_SLOTS = ['avatar', 'banner'];

export async function getProfile(uid) {
  const profile = await userService.getProfile(uid);
  if (!profile) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }
  return profile;
}

/**
 * Valida e aplica PATCH /api/profile. Campos desconhecidos são rejeitados
 * (proteção contra mass assignment, §24). Email nunca é gravável — vem do token.
 */
export async function updateProfile(uid, email, body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.');
  }

  const unknownFields = Object.keys(body).filter((key) => !PATCHABLE_FIELDS.includes(key));
  if (unknownFields.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Campo não permitido: ${unknownFields[0]}.`);
  }
  const knownFields = Object.keys(body).filter((key) => PATCHABLE_FIELDS.includes(key));
  if (knownFields.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Nenhum campo para atualizar.');
  }

  const patch = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length < 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Nome de exibição inválido.');
    }
    if (body.displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Nome de exibição deve ter no máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres.`);
    }
    patch.displayName = body.displayName.trim();
  }

  if (body.username !== undefined) {
    if (body.username === null) {
      patch.username = null;
    } else {
      if (typeof body.username !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Username inválido.');
      }
      const normalized = normalizeUsername(body.username);
      if (
        normalized.length < USERNAME_MIN_LENGTH ||
        normalized.length > USERNAME_MAX_LENGTH ||
        !USERNAME_PATTERN.test(normalized)
      ) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          `Username deve ter entre ${USERNAME_MIN_LENGTH} e ${USERNAME_MAX_LENGTH} caracteres (a-z, 0-9 e _).`,
        );
      }
      patch.username = normalized;
    }
  }

  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.length > MAX_BIO_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Bio deve ter no máximo ${MAX_BIO_LENGTH} caracteres.`);
    }
    patch.bio = body.bio.trim();
  }

  for (const slot of IMAGE_SLOTS) {
    if (body[slot] !== undefined) {
      patch[slot] = body[slot] === null ? null : validateImageMeta(body[slot], slot);
    }
  }

  const { profile, replacedImages } = await userService.upsertProfile(uid, email, patch);
  for (const meta of Object.values(replacedImages)) {
    await deleteOldImage(meta);
  }
  return profile;
}

function validateImageMeta(value, slot) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Metadados de ${slot} inválidos.`);
  }
  const { fileId, url, mimeType } = value;
  if (typeof fileId !== 'string' || fileId.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Metadados de ${slot} inválidos.`);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', `URL de ${slot} inválida.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new ApiError(400, 'VALIDATION_ERROR', `URL de ${slot} precisa ser https.`);
  }
  if (!PROFILE_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Tipo de imagem de ${slot} inválido.`);
  }
  return { fileId, url, mimeType };
}

/**
 * Fluxo de upload de avatar/banner (§13/§14): valida tamanho e magic bytes,
 * envia ao V0X, persiste metadados no MongoDB e tenta apagar a imagem
 * anterior no V0X — falha na exclusão NUNCA invalida o novo perfil (§16).
 */
export async function uploadProfileImage(uid, slot, file) {
  if (!IMAGE_SLOTS.includes(slot)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slot de imagem inválido.');
  }
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Arquivo não enviado.');
  }
  if (file.buffer.length > PROFILE_IMAGE_MAX_BYTES[slot]) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `Arquivo muito grande (máx. ${PROFILE_IMAGE_MAX_BYTES[slot] / (1024 * 1024)} MB).`);
  }

  const detectedMime = detectImageMimetype(file.buffer);
  if (!detectedMime) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Conteúdo de imagem inválido ou formato não suportado.');
  }

  const filename = path.basename(file.originalname || `upload.${detectedMime.split('/')[1]}`);

  let uploaded;
  try {
    uploaded = await v0xService.uploadFile(file.buffer, filename, detectedMime);
  } catch (error) {
    console.error('[v0x] falha no upload:', { code: error.code ?? 'unknown', status: error.status ?? null });
    throw new ApiError(502, 'UPLOAD_FAILED', 'Falha ao enviar a imagem. Tente novamente.');
  }

  const result = await userService.setImage(uid, slot, {
    fileId: uploaded.fileId,
    url: uploaded.url,
    mimeType: detectedMime,
  });
  if (!result) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }

  await deleteOldImage(result.previous);
  return result.profile;
}

/** Exclusão best-effort da imagem anterior no V0X (§16) — nunca lança. */
async function deleteOldImage(meta) {
  if (!meta?.fileId) return;
  try {
    await v0xService.deleteFile(meta.fileId);
  } catch (error) {
    console.error('[v0x] falha ao excluir arquivo antigo:', {
      fileId: meta.fileId,
      code: error.code ?? 'unknown',
    });
  }
}
