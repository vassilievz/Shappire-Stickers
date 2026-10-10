import crypto from 'node:crypto';
import { MonthlyDonorCharge } from '../models/MonthlyDonorCharge.js';
import * as goatPayService from './goatPayService.js';
import * as userService from './userService.js';
import * as monthlyDonorService from './monthlyDonorService.js';
import { ApiError } from '../utils/apiError.js';
import {
  INITIAL_SUPPORTER_BADGE,
  MONTHLY_DONOR_AMOUNT_BRL,
} from '@shappire/contracts';
import { env } from '../config/env.js';
import { ensureUserRecord } from './userIdentityService.js';

const STATUS_CHECK_COOLDOWN_MS = 4000;

function betaBadgeEnabled() {
  const raw = process.env.DONOR_BETA_BADGE_ENABLED;
  if (raw === undefined || raw === '') return env.nodeEnv !== 'production';
  return raw === 'true' || raw === '1';
}

export async function createMonthlyDonorCharge({ uid, email = null }) {
  await ensureUserRecord(uid, email);

  const chargeId = crypto.randomUUID();
  const amount = MONTHLY_DONOR_AMOUNT_BRL;
  const description = 'Doador Mensal Shappire Stickers (30 dias)';

  const pixResult = await goatPayService.createPixCharge({
    amount,
    description,
    externalReference: chargeId,
    expirationSeconds: 86400,
  });

  const charge = new MonthlyDonorCharge({
    chargeId,
    firebaseUid: uid,
    amount,
    description,
    goatpayId: pixResult.id,
    copyPaste: pixResult.copyPaste,
    status: 'PENDING',
    rawStatus: pixResult.status,
    expiresAt: pixResult.expiresAt,
  });

  await charge.save();

  return {
    chargeId: charge.chargeId,
    amount: charge.amount,
    copyPaste: charge.copyPaste,
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    status: charge.status,
  };
}

async function applyPaidBenefits(charge, { email = null } = {}) {
  if (charge.benefitGranted) {
    return;
  }
  await monthlyDonorService.grantMonthlyDonorPeriod(charge.firebaseUid, { email });
  charge.benefitGranted = true;

  if (betaBadgeEnabled()) {
    const profile = await userService.grantBadge(charge.firebaseUid, INITIAL_SUPPORTER_BADGE, { email });
    charge.badgeGranted = Boolean(profile?.badges?.includes(INITIAL_SUPPORTER_BADGE));
  }
}

export async function checkMonthlyDonorChargeStatus({ uid, chargeId, email = null }) {
  const charge = await MonthlyDonorCharge.findOne({ chargeId, firebaseUid: uid });
  if (!charge) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Cobrança não encontrada.');
  }

  const monthlyDonor = await monthlyDonorService.getMonthlyDonorStatusForUid(uid);

  if (charge.status === 'PAID') {
    return {
      chargeId: charge.chargeId,
      status: charge.status,
      paidAt: charge.paidAt?.toISOString() ?? null,
      monthlyDonor,
      badgeGranted: charge.badgeGranted,
    };
  }

  const now = Date.now();
  if (charge.lastCheckedAt && now - charge.lastCheckedAt.getTime() < STATUS_CHECK_COOLDOWN_MS) {
    return {
      chargeId: charge.chargeId,
      status: charge.status,
      paidAt: charge.paidAt?.toISOString() ?? null,
      monthlyDonor,
      badgeGranted: charge.badgeGranted,
    };
  }

  const lookupKey = charge.goatpayId || charge.chargeId;
  const goatStatus = await goatPayService.getPixStatus(lookupKey);
  charge.lastCheckedAt = new Date();

  if (goatStatus) {
    charge.rawStatus = goatStatus.status;
    if (goatStatus.status === 'COMPLETED') {
      if (goatStatus.amount != null && Number(goatStatus.amount) !== charge.amount) {
        throw new ApiError(400, 'INVALID_AMOUNT', 'Valor confirmado não corresponde à cobrança.');
      }
      charge.status = 'PAID';
      charge.paidAt = goatStatus.completedAt || new Date();
      await applyPaidBenefits(charge, { email });
    } else if (goatStatus.status === 'CANCELED') {
      charge.status = 'EXPIRED';
    } else if (goatStatus.status === 'FAILED') {
      charge.status = 'FAILED';
    }
  }

  await charge.save();
  const updatedDonor = await monthlyDonorService.getMonthlyDonorStatusForUid(uid);

  return {
    chargeId: charge.chargeId,
    status: charge.status,
    paidAt: charge.paidAt?.toISOString() ?? null,
    monthlyDonor: updatedDonor,
    badgeGranted: charge.badgeGranted,
  };
}
