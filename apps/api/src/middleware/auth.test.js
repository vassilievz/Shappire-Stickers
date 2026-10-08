import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const verifyIdToken = vi.fn();
  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
      auth: () => ({ verifyIdToken }),
    },
  };
});

import admin from 'firebase-admin';
import { requireAuth } from './auth.js';

const { verifyIdToken } = admin.auth();

function buildRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res;
}

beforeEach(() => {
  verifyIdToken.mockReset();
});

describe('requireAuth', () => {
  it('rejeita requisição sem header Authorization', async () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejeita header que não é Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' } };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejeita Bearer vazio', async () => {
    const req = { headers: { authorization: 'Bearer ' } };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('popula req.user com uid/email do token verificado', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' });
    const req = { headers: { authorization: 'Bearer token-valido' } };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ uid: 'user-1', email: 'user@example.com' });
    expect(verifyIdToken).toHaveBeenCalledWith('token-valido');
  });

  it('rejeita token inválido (verifyIdToken falha)', async () => {
    verifyIdToken.mockRejectedValue(new Error('token expirado'));
    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('não confia em campos de identidade enviados pelo cliente', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-real', email: 'real@example.com' });
    const req = {
      headers: { authorization: 'Bearer token-valido' },
      body: { uid: 'uid-falsificado', email: 'falso@example.com' },
    };
    const res = buildRes();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(req.user.uid).toBe('uid-real');
    expect(req.user.email).toBe('real@example.com');
  });
});
