import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
function chainUser(doc) {
  return {
    select: vi.fn().mockResolvedValue(doc),
  };
}

vi.mock('../models/User.js', () => ({
  User: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { User } from '../models/User.js';
import { acknowledgeAdultEligibility, canViewAdultContent } from './socialAccessService.js';

describe('socialAccessService adult eligibility', () => {
  const original = process.env.ADULT_CONTENT_SELF_ATTESTATION;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADULT_CONTENT_SELF_ATTESTATION;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADULT_CONTENT_SELF_ATTESTATION;
    else process.env.ADULT_CONTENT_SELF_ATTESTATION = original;
  });

  it('rejeita elegibilidade quando autoatribuição não está habilitada', async () => {
    await expect(acknowledgeAdultEligibility('uid-1')).rejects.toMatchObject({
      code: 'ADULT_CONTENT_RESTRICTED',
    });
  });

  it('permite elegibilidade apenas com ADULT_CONTENT_SELF_ATTESTATION=true', async () => {
    process.env.ADULT_CONTENT_SELF_ATTESTATION = 'true';
    User.findOneAndUpdate.mockResolvedValue({ firebaseUid: 'uid-1' });
    User.findOne.mockReturnValue(
      chainUser({
        firebaseUid: 'uid-1',
        preferences: { showAdultContent: false, adultContentEligible: true },
      }),
    );
    const prefs = await acknowledgeAdultEligibility('uid-1');
    expect(prefs.adultContentEligible).toBe(true);
  });

  it('canViewAdultContent exige elegibilidade e preferência', async () => {
    User.findOne.mockReturnValue(
      chainUser({ preferences: { showAdultContent: true, adultContentEligible: false } }),
    );
    expect(await canViewAdultContent('uid-1')).toBe(false);
    User.findOne.mockReturnValue(
      chainUser({ preferences: { showAdultContent: true, adultContentEligible: true } }),
    );
    expect(await canViewAdultContent('uid-1')).toBe(true);
  });
});
