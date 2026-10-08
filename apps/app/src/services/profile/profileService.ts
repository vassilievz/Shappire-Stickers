import {
  PROFILE_IMAGE_MAX_BYTES,
  validateBio,
  validateDisplayName,
  validateUsername,
  type ProfileImage,
  type ProfileImageSlot,
} from '@/domain/profile';
import { fetchProfile, updateProfile, uploadProfileImage, type ProfilePatch } from '@/services/api/profileApi';
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
 * Envia a imagem escolhida no aparelho para a API (multipart, campo `file`).
 * O limite é pré-checado no cliente para falhar rápido sem gastar rede; o
 * servidor revalida tamanho e magic bytes (§15).
 */
async function uploadDeviceImage(
  slot: ProfileImageSlot,
  action: { dataUrl: string; mimeType: string },
): Promise<ProfileImage> {
  const blob = await dataUrlToBlob(action.dataUrl);
  const maxBytes = PROFILE_IMAGE_MAX_BYTES[slot];
  if (blob.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new AppError('IMAGE_TOO_LARGE', `A imagem excede o tamanho máximo de ${maxMb} MB.`, {
      details: { field: slot },
    });
  }

  const profile = await uploadProfileImage(slot, blob);
  const meta = profile[slot];
  if (!meta) {
    logger.warn(`Resposta da API sem metadados de ${slot}.`);
    throw new AppError('UPLOAD_FAILED', 'Não foi possível enviar a imagem.');
  }
  return meta;
}

/**
 * Fluxo de salvamento do perfil via API Shappire:
 * 1. valida nome, bio e username localmente (feedback rápido);
 * 2. imagens de dispositivo sobem primeiro (POST multipart) — a API envia ao
 *    V0X, grava só metadados no MongoDB e apaga a imagem antiga (§13/§16);
 * 3. um único PATCH grava os campos e devolve o perfil consolidado.
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

  let avatar = current.avatar;
  if (draft.avatar.kind === 'remove') {
    avatar = null;
  } else if (draft.avatar.kind === 'device') {
    avatar = await uploadDeviceImage('avatar', draft.avatar);
  }

  let banner = current.banner;
  if (draft.banner.kind === 'remove') {
    banner = null;
  } else if (draft.banner.kind === 'device') {
    banner = await uploadDeviceImage('banner', draft.banner);
  }

  const patch: ProfilePatch = {
    displayName,
    username,
    bio: draft.bio.trim(),
    avatar,
    banner,
  };

  return updateProfile(patch);
}

/**
 * Busca o perfil online; null significa "ainda não criado no MongoDB" — o
 * documento nasce no primeiro salvamento via PATCH.
 */
export async function loadProfile(): Promise<UserProfile | null> {
  return fetchProfile();
}
