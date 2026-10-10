import crypto from 'node:crypto';
import { Donation } from '../models/Donation.js';
import * as goatPayService from './goatPayService.js';
import * as userService from './userService.js';
import { ApiError } from '../utils/apiError.js';
import {
  INITIAL_SUPPORTER_BADGE,
  DONATION_MIN_AMOUNT,
  DONATION_MAX_AMOUNT,
} from '@shappire/contracts';

const STATUS_CHECK_COOLDOWN_MS = 4000; // 4 segundos de cooldown para evitar spam

export async function createDonation({ uid, amount }) {
  const parsedAmount = Number(amount);
  if (
    !Number.isFinite(parsedAmount) ||
    !Number.isInteger(parsedAmount) ||
    parsedAmount < DONATION_MIN_AMOUNT ||
    parsedAmount > DONATION_MAX_AMOUNT
  ) {
    throw new ApiError(
      400,
      'INVALID_AMOUNT',
      `O valor deve ser entre R$ ${DONATION_MIN_AMOUNT} e R$ ${DONATION_MAX_AMOUNT}.`,
    );
  }

  const donationId = crypto.randomUUID();
  const description = 'Apoio voluntário Shappire Stickers';

  const pixResult = await goatPayService.createPixCharge({
    amount: parsedAmount,
    description,
    externalReference: donationId,
    expirationSeconds: 86400, // 24 horas
  });

  const donation = new Donation({
    donationId,
    firebaseUid: uid,
    amount: parsedAmount,
    description,
    goatpayId: pixResult.id,
    copyPaste: pixResult.copyPaste,
    status: 'PENDING',
    rawStatus: pixResult.status,
    expiresAt: pixResult.expiresAt,
  });

  await donation.save();

  return {
    donationId: donation.donationId,
    amount: donation.amount,
    copyPaste: donation.copyPaste,
    expiresAt: donation.expiresAt?.toISOString() ?? null,
    status: donation.status,
  };
}

export async function checkDonationStatus({ uid, donationId, email = null }) {
  const donation = await Donation.findOne({ donationId, firebaseUid: uid });
  if (!donation) {
    throw new ApiError(404, 'DONATION_NOT_FOUND', 'Doação não encontrada.');
  }

  // Se já está paga, nunca reverte nem faz novas consultas externas
  if (donation.status === 'PAID') {
    return {
      donationId: donation.donationId,
      status: donation.status,
      paidAt: donation.paidAt?.toISOString() ?? null,
      badgeGranted: donation.badgeGranted,
    };
  }

  // Se verificado há menos de STATUS_CHECK_COOLDOWN_MS, respeita o cooldown
  const now = Date.now();
  if (donation.lastCheckedAt && now - donation.lastCheckedAt.getTime() < STATUS_CHECK_COOLDOWN_MS) {
    return {
      donationId: donation.donationId,
      status: donation.status,
      paidAt: donation.paidAt?.toISOString() ?? null,
      badgeGranted: donation.badgeGranted,
    };
  }

  const lookupKey = donation.goatpayId || donation.donationId;
  const goatStatus = await goatPayService.getPixStatus(lookupKey);

  donation.lastCheckedAt = new Date();

  if (goatStatus) {
    donation.rawStatus = goatStatus.status;

    if (goatStatus.status === 'COMPLETED') {
      donation.status = 'PAID';
      donation.paidAt = goatStatus.completedAt || new Date();

      const profile = await userService.grantBadge(uid, INITIAL_SUPPORTER_BADGE, { email });
      donation.badgeGranted = Boolean(profile?.badges?.includes(INITIAL_SUPPORTER_BADGE));
    } else if (goatStatus.status === 'CANCELED') {
      donation.status = 'EXPIRED';
    } else if (goatStatus.status === 'FAILED') {
      donation.status = 'FAILED';
    }
  }

  await donation.save();

  return {
    donationId: donation.donationId,
    status: donation.status,
    paidAt: donation.paidAt?.toISOString() ?? null,
    badgeGranted: donation.badgeGranted,
  };
}

export async function getUserDonations(uid) {
  const docs = await Donation.find({ firebaseUid: uid }).sort({ createdAt: -1 }).limit(20);
  return docs.map((doc) => ({
    donationId: doc.donationId,
    amount: doc.amount,
    status: doc.status,
    paidAt: doc.paidAt?.toISOString() ?? null,
    createdAt: doc.createdAt?.toISOString() ?? null,
    badgeGranted: doc.badgeGranted,
  }));
}
