import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/User.js', () => ({
  User: {
    findOne: vi.fn(),
  },
}));

vi.mock('./avatarDecorationCatalog.js', () => ({
  isKnownDecorationId: vi.fn(),
}));

import { User } from '../models/User.js';
import { isKnownDecorationId } from './avatarDecorationCatalog.js';
import { setAvatarDecoration } from './avatarDecorationService.js';

describe('avatarDecorationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita decoração desconhecida', async () => {
    isKnownDecorationId.mockReturnValue(false);
    await expect(setAvatarDecoration({ uid: 'u1', decorationId: 'x' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('bloqueia salvar sem doador mensal ativo', async () => {
    isKnownDecorationId.mockReturnValue(true);
    User.findOne.mockResolvedValue({
      firebaseUid: 'u1',
      monthlyDonorExpiresAt: new Date(Date.now() - 1000),
      save: vi.fn(),
    });
    await expect(setAvatarDecoration({ uid: 'u1', decorationId: 'valid' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'MONTHLY_DONOR_REQUIRED',
    });
  });
});
