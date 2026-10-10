import { MONTHLY_DONOR_PERIOD_DAYS } from '@shappire/contracts';
import { User } from '../models/User.js';
import { ensureUserRecord } from './userIdentityService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeMonthlyDonorStatus(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return { active: false, expiresAt: null, daysRemaining: 0 };
  }
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return { active: false, expiresAt: expiry.toISOString(), daysRemaining: 0 };
  }
  const msLeft = expiry.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / MS_PER_DAY));
  return {
    active: true,
    expiresAt: expiry.toISOString(),
    daysRemaining,
  };
}

export function isMonthlyDonorActive(doc, now = new Date()) {
  if (!doc?.monthlyDonorExpiresAt) return false;
  const expiry = doc.monthlyDonorExpiresAt instanceof Date
    ? doc.monthlyDonorExpiresAt
    : new Date(doc.monthlyDonorExpiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > now.getTime();
}

/**
 * Concede ou prolonga 30 dias a partir da expiração atual (stacking).
 * Retorna o documento atualizado.
 */
export async function grantMonthlyDonorPeriod(firebaseUid, { now = new Date(), email = null } = {}) {
  let doc = await User.findOne({ firebaseUid });
  if (!doc) {
    doc = await ensureUserRecord(firebaseUid, email);
  }
  if (!doc) return null;

  const currentExpiry = doc.monthlyDonorExpiresAt instanceof Date
    ? doc.monthlyDonorExpiresAt
    : doc.monthlyDonorExpiresAt
      ? new Date(doc.monthlyDonorExpiresAt)
      : null;

  const base =
    currentExpiry && !Number.isNaN(currentExpiry.getTime()) && currentExpiry.getTime() > now.getTime()
      ? currentExpiry
      : now;

  const newExpiry = new Date(base.getTime() + MONTHLY_DONOR_PERIOD_DAYS * MS_PER_DAY);
  doc.monthlyDonorExpiresAt = newExpiry;
  await doc.save();
  return doc;
}

export async function getMonthlyDonorStatusForUid(firebaseUid) {
  const doc = await User.findOne({ firebaseUid }).select('monthlyDonorExpiresAt').lean();
  return computeMonthlyDonorStatus(doc?.monthlyDonorExpiresAt ?? null);
}
