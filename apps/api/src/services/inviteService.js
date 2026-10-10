import crypto from 'node:crypto';
import {
  REFERRAL_APPLY_MAX_ACCOUNT_AGE_MS,
  REFERRAL_INVITES_PER_REWARD,
  REFERRAL_STATUSES,
} from '@shappire/contracts';
import { User } from '../models/User.js';
import { Referral } from '../models/Referral.js';
import { ReferralReward } from '../models/ReferralReward.js';
import { ApiError } from '../utils/apiError.js';
import * as monthlyDonorService from './monthlyDonorService.js';
import {
  ensureUserRecord,
  findUserByInviteCode,
  normalizeInviteCodeInput,
} from './userIdentityService.js';

export async function getInviteMe(uid, email = null) {
  const doc = await ensureUserRecord(uid, email);
  return {
    inviteCode: doc.inviteCode,
    publicId: doc.publicId,
  };
}

export function buildInviteProgress(doc) {
  const qualifiedInvites = doc.referralQualifiedCount ?? 0;
  const rewardsClaimed = doc.referralRewardsClaimed ?? 0;
  const totalSlotsUsed = rewardsClaimed * REFERRAL_INVITES_PER_REWARD;
  const invitesTowardNextReward = Math.max(0, qualifiedInvites - totalSlotsUsed);
  const displayToward =
    invitesTowardNextReward === 0
      ? 0
      : invitesTowardNextReward % REFERRAL_INVITES_PER_REWARD || REFERRAL_INVITES_PER_REWARD;
  const rewardsAvailable = Math.floor(qualifiedInvites / REFERRAL_INVITES_PER_REWARD) - rewardsClaimed;

  return {
    inviteCode: doc.inviteCode,
    qualifiedInvites: displayToward,
    invitesTowardNextReward: displayToward,
    invitesPerReward: REFERRAL_INVITES_PER_REWARD,
    rewardsAvailable: Math.max(0, rewardsAvailable),
    rewardsClaimed,
    totalQualifiedInvites: qualifiedInvites,
    hasAppliedInvite: Boolean(doc.referredByUid),
  };
}

export async function getInviteProgress(uid, email = null) {
  const doc = await ensureUserRecord(uid, email);
  return buildInviteProgress(doc);
}

export async function applyInviteCode({ uid, code, email = null }) {
  const normalized = normalizeInviteCodeInput(code);
  if (!normalized) {
    throw new ApiError(400, 'INVITE_INVALID', 'Código de convite inválido.');
  }

  const invitee = await ensureUserRecord(uid, email);

  if (invitee.referredByUid) {
    throw new ApiError(409, 'INVITE_ALREADY_APPLIED', 'Esta conta já utilizou um código de convite.');
  }

  const accountAgeMs = Date.now() - (invitee.createdAt?.getTime() ?? Date.now());
  if (accountAgeMs > REFERRAL_APPLY_MAX_ACCOUNT_AGE_MS) {
    throw new ApiError(403, 'INVITE_NOT_ELIGIBLE', 'Esta conta não é elegível para aplicar um convite.');
  }

  const inviter = await findUserByInviteCode(normalized);
  if (!inviter) {
    throw new ApiError(404, 'INVITE_INVALID', 'Código de convite não encontrado.');
  }
  if (inviter.firebaseUid === uid) {
    throw new ApiError(400, 'INVITE_SELF', 'Você não pode usar o seu próprio código.');
  }

  try {
    await Referral.create({
      inviterUid: inviter.firebaseUid,
      inviteeUid: uid,
      inviteCode: normalized,
      status: REFERRAL_STATUSES.qualified,
      qualifiedAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'INVITE_ALREADY_APPLIED', 'Esta conta já utilizou um código de convite.');
    }
    throw error;
  }

  invitee.referredByUid = inviter.firebaseUid;
  await invitee.save();

  await monthlyDonorService.grantMonthlyDonorPeriod(uid);

  await User.updateOne(
    { firebaseUid: inviter.firebaseUid },
    { $inc: { referralQualifiedCount: 1 } },
  );

  const monthlyDonor = await monthlyDonorService.getMonthlyDonorStatusForUid(uid);
  return { applied: true, monthlyDonor };
}

export async function redeemInviteReward({ uid, email = null }) {
  const doc = await ensureUserRecord(uid, email);

  const progress = buildInviteProgress(doc);
  if (progress.rewardsAvailable < 1) {
    throw new ApiError(403, 'REWARD_NOT_AVAILABLE', 'Nenhuma recompensa disponível para resgate.');
  }

  const redemptionId = crypto.randomUUID();
  try {
    await ReferralReward.create({
      redemptionId,
      firebaseUid: uid,
      invitesConsumed: REFERRAL_INVITES_PER_REWARD,
      grantedExpiresAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'CONFLICT', 'Resgate já processado.');
    }
    throw error;
  }

  const minQualified = (doc.referralRewardsClaimed + 1) * REFERRAL_INVITES_PER_REWARD;
  const updated = await User.findOneAndUpdate(
    {
      firebaseUid: uid,
      referralQualifiedCount: { $gte: minQualified },
    },
    { $inc: { referralRewardsClaimed: 1 } },
    { new: true },
  );

  if (!updated) {
    throw new ApiError(403, 'REWARD_NOT_AVAILABLE', 'Nenhuma recompensa disponível para resgate.');
  }

  const grantedDoc = await monthlyDonorService.grantMonthlyDonorPeriod(uid);
  const monthlyDonor = monthlyDonorService.computeMonthlyDonorStatus(grantedDoc?.monthlyDonorExpiresAt);
  const afterProgress = buildInviteProgress(updated);

  return {
    redeemed: true,
    monthlyDonor,
    rewardsAvailable: afterProgress.rewardsAvailable,
  };
}
