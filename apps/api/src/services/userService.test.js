import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/User.js', () => {
  class User {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn(async () => this);
    }
  }
  User.findOne = vi.fn();
  User.findOneAndUpdate = vi.fn();
  User.exists = vi.fn();
  return { User };
});

import { User } from '../models/User.js';
import { getProfile, toProfileJson, upsertProfile, setImage, grantBadge } from './userService.js';

const findOne = User.findOne;
const findOneAndUpdate = User.findOneAndUpdate;

function imageMeta(fileId) {
  return {
    fileId,
    url: `https://cdn.v0x.lol/${fileId}.png`,
    mimeType: 'image/png',
    toObject() {
      const { fileId: id, url, mimeType } = this;
      return { fileId: id, url, mimeType };
    },
  };
}

function existingDoc(overrides = {}) {
  return {
    firebaseUid: 'uid-1',
    email: 'antigo@example.com',
    displayName: 'Vasil',
    username: 'vasil',
    bio: 'bio antiga',
    avatar: null,
    banner: null,
    inviteCode: 'ABCD2345',
    publicId: 'pub-1',
    avatarDecorationId: null,
    monthlyDonorExpiresAt: null,
    referredByUid: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    save: vi.fn(async function save() {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => {
  findOne.mockReset();
});

describe('toProfileJson', () => {
  it('converte o documento Mongo para o JSON de perfil com fallbacks', () => {
    const doc = existingDoc({ username: null, bio: undefined, avatar: imageMeta('avatar-1') });

    expect(toProfileJson(doc)).toEqual({
      uid: 'uid-1',
      email: 'antigo@example.com',
      displayName: 'Vasil',
      username: null,
      bio: '',
      avatar: { fileId: 'avatar-1', url: 'https://cdn.v0x.lol/avatar-1.png', mimeType: 'image/png' },
      banner: null,
      badges: [],
      avatarDecorationId: null,
      avatarDecoration: null,
      monthlyDonor: { active: false, expiresAt: null, daysRemaining: 0 },
      inviteCode: 'ABCD2345',
      publicId: 'pub-1',
      referredByUid: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('preserva badges do documento Mongo', () => {
    const doc = existingDoc({ badges: ['initial_supporter'] });
    expect(toProfileJson(doc).badges).toEqual(['initial_supporter']);
  });
});

describe('getProfile', () => {
  it('retorna null quando não existe documento', async () => {
    findOne.mockResolvedValue(null);

    expect(await getProfile('uid-1')).toBeNull();
    expect(findOne).toHaveBeenCalledWith({ firebaseUid: 'uid-1' });
  });

  it('retorna o perfil convertido quando existe', async () => {
    findOne.mockResolvedValue(existingDoc());

    const profile = await getProfile('uid-1');

    expect(profile.uid).toBe('uid-1');
    expect(profile.username).toBe('vasil');
  });
});

describe('upsertProfile', () => {
  it('rejeita username já usado por outro usuário (409 USERNAME_TAKEN)', async () => {
    findOne.mockResolvedValue(existingDoc({ firebaseUid: 'uid-2' }));

    await expect(upsertProfile('uid-1', 'a@example.com', { username: 'vasil' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'USERNAME_TAKEN',
    });
    expect(findOne).toHaveBeenCalledWith({ username: 'vasil', firebaseUid: { $ne: 'uid-1' } });
  });

  it('cria o perfil quando não existe, usando email do token', async () => {
    findOne.mockResolvedValue(null);

    const result = await upsertProfile('uid-novo', 'novo@example.com', {
      displayName: 'Novo Usuário',
      username: 'novo',
      bio: 'olá',
    });

    expect(result.created).toBe(true);
    expect(result.replacedImages).toEqual({});
    expect(result.profile).toMatchObject({
      uid: 'uid-novo',
      email: 'novo@example.com',
      displayName: 'Novo Usuário',
      username: 'novo',
      bio: 'olá',
      avatar: null,
      banner: null,
    });
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOne).toHaveBeenNthCalledWith(2, { firebaseUid: 'uid-novo' });
  });

  it('atualiza email a partir do token e aplica o patch', async () => {
    const doc = existingDoc();
    findOne.mockResolvedValue(doc);

    const result = await upsertProfile('uid-1', 'novo-email@example.com', {
      displayName: 'Vasil 2',
      bio: 'nova bio',
    });

    expect(result.created).toBe(false);
    expect(doc.email).toBe('novo-email@example.com');
    expect(doc.displayName).toBe('Vasil 2');
    expect(doc.bio).toBe('nova bio');
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ firebaseUid: 'uid-1' });
  });

  it('registra imagem substituída quando o fileId muda', async () => {
    const doc = existingDoc({ avatar: imageMeta('avatar-antigo') });
    findOne.mockResolvedValue(doc);

    const result = await upsertProfile('uid-1', 'a@example.com', { avatar: imageMeta('avatar-novo') });

    expect(result.replacedImages.avatar.fileId).toBe('avatar-antigo');
    expect(result.profile.avatar).toEqual({
      fileId: 'avatar-novo',
      url: 'https://cdn.v0x.lol/avatar-novo.png',
      mimeType: 'image/png',
    });
  });

  it('não registra substituição quando o fileId é o mesmo', async () => {
    const doc = existingDoc({ banner: imageMeta('banner-1') });
    findOne.mockResolvedValue(doc);

    const result = await upsertProfile('uid-1', 'a@example.com', { banner: imageMeta('banner-1') });

    expect(result.replacedImages).toEqual({});
  });
});

describe('setImage', () => {
  it('retorna null quando o perfil não existe', async () => {
    findOne.mockResolvedValue(null);

    expect(await setImage('uid-x', 'avatar', imageMeta('novo'))).toBeNull();
  });

  it('define a nova imagem e devolve a anterior para limpeza no V0X', async () => {
    const doc = existingDoc({ avatar: imageMeta('avatar-antigo') });
    findOne.mockResolvedValue(doc);

    const result = await setImage('uid-1', 'avatar', imageMeta('avatar-novo'));

    expect(result.previous.fileId).toBe('avatar-antigo');
    expect(result.profile.avatar.fileId).toBe('avatar-novo');
    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});

describe('grantBadge', () => {
  it('adiciona badge com $addToSet no banco e retorna perfil atualizado', async () => {
    const doc = existingDoc({ badges: ['initial_supporter'] });
    findOneAndUpdate.mockResolvedValue(doc);

    const profile = await grantBadge('uid-1', 'initial_supporter');

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { firebaseUid: 'uid-1' },
      { $addToSet: { badges: 'initial_supporter' } },
      { new: true },
    );
    expect(profile.badges).toContain('initial_supporter');
  });

  it('retorna null se usuário não existir e email não for informado', async () => {
    findOneAndUpdate.mockResolvedValue(null);
    expect(await grantBadge('inexistente', 'initial_supporter')).toBeNull();
  });

  it('faz upsert do usuário quando email é informado', async () => {
    const doc = existingDoc({ badges: ['initial_supporter'] });
    findOneAndUpdate.mockResolvedValue(doc);

    await grantBadge('uid-novo', 'initial_supporter', { email: 'novo@example.com' });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { firebaseUid: 'uid-novo' },
      expect.objectContaining({
        $addToSet: { badges: 'initial_supporter' },
        $setOnInsert: expect.objectContaining({
          firebaseUid: 'uid-novo',
          email: 'novo@example.com',
        }),
      }),
      expect.objectContaining({ upsert: true, new: true }),
    );
  });
});

