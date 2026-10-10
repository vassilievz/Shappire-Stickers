import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/User.js', () => {
  const users = new Map();
  return {
    User: {
      findOne: vi.fn(async ({ firebaseUid }) => users.get(firebaseUid) ?? null),
      async saveDoc(doc) {
        users.set(doc.firebaseUid, doc);
      },
    },
    __users: users,
  };
});

import { User, __users } from '../models/User.js';
import {
  computeMonthlyDonorStatus,
  grantMonthlyDonorPeriod,
  isMonthlyDonorActive,
} from './monthlyDonorService.js';

describe('monthlyDonorService', () => {
  beforeEach(() => {
    __users.clear();
    User.findOne.mockImplementation(async ({ firebaseUid }) => __users.get(firebaseUid) ?? null);
  });

  it('detecta expiração corretamente', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(computeMonthlyDonorStatus(future).active).toBe(true);
    const past = new Date(Date.now() - 1000);
    expect(computeMonthlyDonorStatus(past).active).toBe(false);
  });

  it('empilha 30 dias a partir da expiração atual', async () => {
    const currentExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const doc = {
      firebaseUid: 'u1',
      monthlyDonorExpiresAt: currentExpiry,
      save: vi.fn(async function save() {
        await User.saveDoc(this);
      }),
    };
    __users.set('u1', doc);

    const updated = await grantMonthlyDonorPeriod('u1');
    const expectedMin = currentExpiry.getTime() + 29 * 24 * 60 * 60 * 1000;
    expect(updated.monthlyDonorExpiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(isMonthlyDonorActive(updated)).toBe(true);
  });
});
