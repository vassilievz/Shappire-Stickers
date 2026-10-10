import { MAX_REPORT_DETAILS_LENGTH, REPORT_REASONS, REPORT_TARGET_TYPES } from '@shappire/contracts';
import { Report } from '../models/Report.js';
import { UserBlock } from '../models/UserBlock.js';
import { Follow } from '../models/Follow.js';
import { ApiError } from '../utils/apiError.js';

export async function createReport(reporterUid, input) {
  const targetType = input.targetType;
  const targetId = String(input.targetId ?? '').trim();
  const reason = input.reason;
  const details = String(input.details ?? '').trim().slice(0, MAX_REPORT_DETAILS_LENGTH);

  if (!Object.values(REPORT_TARGET_TYPES).includes(targetType)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tipo de denúncia inválido.');
  }
  if (!targetId) throw new ApiError(400, 'VALIDATION_ERROR', 'Alvo da denúncia inválido.');
  if (!REPORT_REASONS.includes(reason)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Motivo de denúncia inválido.');
  }

  await Report.create({
    reporterUid,
    targetType,
    targetId,
    reason,
    details,
  });
  return { ok: true };
}

export async function blockUser(blockerUid, blockedUid) {
  if (blockerUid === blockedUid) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Você não pode bloquear a si mesmo.');
  }
  try {
    await UserBlock.create({ blockerUid, blockedUid });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  await Follow.deleteMany({
    $or: [
      { followerUid: blockerUid, followingUid: blockedUid },
      { followerUid: blockedUid, followingUid: blockerUid },
    ],
  });
  return { blocked: true };
}

export async function unblockUser(blockerUid, blockedUid) {
  await UserBlock.findOneAndDelete({ blockerUid, blockedUid });
  return { blocked: false };
}
