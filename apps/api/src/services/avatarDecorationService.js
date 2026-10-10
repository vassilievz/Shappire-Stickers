import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { isKnownDecorationId, toActiveDecoration } from './avatarDecorationCatalog.js';
import { isMonthlyDonorActive } from './monthlyDonorService.js';
export async function setAvatarDecoration({ uid, decorationId }) {
  if (!isKnownDecorationId(decorationId)) {
    throw new ApiError(400, 'INVALID_DECORATION', 'Decoração não encontrada no catálogo autorizado.');
  }

  const doc = await User.findOne({ firebaseUid: uid });
  if (!doc) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }

  if (!isMonthlyDonorActive(doc)) {
    throw new ApiError(403, 'MONTHLY_DONOR_REQUIRED', 'Doador Mensal ativo é necessário para salvar decorações premium.');
  }

  doc.avatarDecorationId = String(decorationId);
  await doc.save();
  return doc;
}

export async function clearAvatarDecoration({ uid }) {
  const doc = await User.findOne({ firebaseUid: uid });
  if (!doc) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
  }
  doc.avatarDecorationId = null;
  await doc.save();
  return doc;
}

export function resolvePublicAvatarDecoration(userDoc) {
  if (!userDoc || !isMonthlyDonorActive(userDoc) || !userDoc.avatarDecorationId) {
    return null;
  }
  return toActiveDecoration(userDoc.avatarDecorationId);
}
