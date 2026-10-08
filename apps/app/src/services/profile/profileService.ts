import {
  PROFILE_IMAGE_MAX_BYTES,
  validateBio,
  validateDisplayName,
  validateUsername,
  type ProfileImageSlot,
} from '@/domain/profile';
import { fetchProfile, updateProfile, uploadProfileImage } from '@/services/api/profileApi';
import type { UserProfile } from '@/services/firebase/types';
import { AppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';

const logger = createLogger('profile-service');

export type ProfileImageAction =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'device'; dataUrl: string; mimeType: string };

export interface ProfileDraft {
  displayName: string;
  username: string;
  bio: string;
  avatar: ProfileImageAction;
  banner: ProfileImageAction;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Pré-valida o tamanho da imagem antes de tocar a rede (§15).
 */
async function prepareDeviceBlob(
  slot: ProfileImageSlot,
  action: { dataUrl: string; mimeType: string },
): Promise<Blob> {
  const blob = await dataUrlToBlob(action.dataUrl);
  const maxBytes = PROFILE_IMAGE_MAX_BYTES[slot];
  if (blob.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new AppError('IMAGE_TOO_LARGE', `A imagem excede o tamanho máximo de ${maxMb} MB.`, {
      details: { field: slot },
    });
  }
  return blob;
}

async function uploadSlotImage(slot: ProfileImageSlot, blob: Blob): Promise<UserProfile> {
  const profile = await uploadProfileImage(slot, blob);
  const meta = profile[slot];
  if (!meta) {
    logger.warn(`Resposta da API sem metadados de ${slot}.`);
    throw new AppError('UPLOAD_FAILED', 'Não foi possível enviar a imagem.');
  }
  return profile;
}

/**
 * Fluxo de salvamento do perfil via API Shappire:
 * 1. valida nome, bio e username localmente (feedback rápido);
 * 2. pré-valida tamanho das imagens escolhidas (evita tráfego inútil);
 * 3. garante a criação/atualização do documento no MongoDB via PATCH (upsertProfile) —
 *    se for o primeiro salvamento do usuário, o documento nasce aqui no MongoDB;
 * 4. com o documento já existente no MongoDB, sobe as imagens de dispositivo (POST multipart) —
 *    a API envia ao V0X, atualiza o slot correspondente no MongoDB e apaga a imagem antiga (§13/§16).
 * O uid vem do ID token no servidor — nunca do cliente (§9/§10).
 */
export async function saveProfile(current: UserProfile, draft: ProfileDraft): Promise<UserProfile> {
  const displayName = draft.displayName.trim();
  if (!validateDisplayName(displayName)) {
    throw new AppError('INVALID_INPUT', 'Nome de exibição inválido.', {
      details: { field: 'displayName' },
    });
  }
  if (!validateBio(draft.bio)) {
    throw new AppError('INVALID_INPUT', 'Bio longa demais.', {
      details: { field: 'bio' },
    });
  }

  const rawUsername = draft.username.trim();
  let username: string | null = null;
  if (rawUsername !== '') {
    const validation = validateUsername(rawUsername);
    if (!validation.valid) {
      throw new AppError('INVALID_INPUT', 'Usuário inválido.', {
        details: { field: 'username', reason: validation.issue },
      });
    }
    username = validation.username;
  }

  // Pré-valida o tamanho das imagens antes de tocar a rede (§15)
  const avatarBlob =
    draft.avatar.kind === 'device' ? await prepareDeviceBlob('avatar', draft.avatar) : null;
  const bannerBlob =
    draft.banner.kind === 'device' ? await prepareDeviceBlob('banner', draft.banner) : null;

  // 1. Garante o documento de perfil no MongoDB via PATCH (upsertProfile) com texto e remoções.
  let profile = await updateProfile({
    displayName,
    username,
    bio: draft.bio.trim(),
    avatar: draft.avatar.kind === 'remove' ? null : current.avatar,
    banner: draft.banner.kind === 'remove' ? null : current.banner,
  });

  // 2. Com o documento garantido no MongoDB, executa os uploads de dispositivo.
  if (avatarBlob) {
    profile = await uploadSlotImage('avatar', avatarBlob);
  }

  if (bannerBlob) {
    profile = await uploadSlotImage('banner', bannerBlob);
  }

  return profile;
}

/**
 * Busca o perfil online; null significa "ainda não criado no MongoDB" — o
 * documento nasce no primeiro salvamento via PATCH.
 */
export async function loadProfile(): Promise<UserProfile | null> {
  return fetchProfile();
}
