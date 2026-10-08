import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./userService.js', () => ({
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  setImage: vi.fn(),
}));

vi.mock('./v0xService.js', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  getFile: vi.fn(),
}));

import * as userService from './userService.js';
import * as v0xService from './v0xService.js';
import * as profileService from './profileService.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const PROFILE = {
  uid: 'uid-1',
  email: 'user@example.com',
  displayName: 'Vasil',
  username: 'vasil',
  bio: '',
  avatar: null,
  banner: null,
  createdAt: null,
  updatedAt: null,
};

beforeEach(() => {
  userService.getProfile.mockReset();
  userService.upsertProfile.mockReset();
  userService.setImage.mockReset();
  v0xService.uploadFile.mockReset();
  v0xService.deleteFile.mockReset();
});

describe('getProfile', () => {
  it('lança 404 PROFILE_NOT_FOUND quando o perfil não existe', async () => {
    userService.getProfile.mockResolvedValue(null);

    await expect(profileService.getProfile('uid-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('retorna o perfil do userService', async () => {
    userService.getProfile.mockResolvedValue(PROFILE);

    await expect(profileService.getProfile('uid-1')).resolves.toBe(PROFILE);
  });
});

describe('updateProfile', () => {
  it('rejeita corpo que não é objeto', async () => {
    for (const body of [null, 'texto', ['array'], 42]) {
      await expect(profileService.updateProfile('uid-1', 'e@x.com', body)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
  });

  it('rejeita campos desconhecidos — inclusive email, que nunca é gravável', async () => {
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { email: 'falso@x.com' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(userService.upsertProfile).not.toHaveBeenCalled();
  });

  it('rejeita corpo sem campos conhecidos', async () => {
    await expect(profileService.updateProfile('uid-1', 'e@x.com', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('valida displayName', async () => {
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { displayName: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { displayName: 'a'.repeat(41) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('normaliza username (trim, acentos, maiúsculas)', async () => {
    userService.upsertProfile.mockResolvedValue({ profile: PROFILE, created: true, replacedImages: {} });

    await profileService.updateProfile('uid-1', 'e@x.com', { username: ' Usuário_2 ' });

    expect(userService.upsertProfile).toHaveBeenCalledWith('uid-1', 'e@x.com', { username: 'usuario_2' });
  });

  it('aceita username null (remoção)', async () => {
    userService.upsertProfile.mockResolvedValue({ profile: PROFILE, created: false, replacedImages: {} });

    await profileService.updateProfile('uid-1', 'e@x.com', { username: null });

    expect(userService.upsertProfile).toHaveBeenCalledWith('uid-1', 'e@x.com', { username: null });
  });

  it('rejeita username inválido após normalização', async () => {
    for (const username of ['ab', 'user name', 'user@name', 'a'.repeat(21)]) {
      await expect(profileService.updateProfile('uid-1', 'e@x.com', { username })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    }
  });

  it('valida bio (string de até 160 caracteres, com trim)', async () => {
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { bio: 'x'.repeat(161) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    userService.upsertProfile.mockResolvedValue({ profile: PROFILE, created: false, replacedImages: {} });
    await profileService.updateProfile('uid-1', 'e@x.com', { bio: '  olá  ' });

    expect(userService.upsertProfile).toHaveBeenCalledWith('uid-1', 'e@x.com', { bio: 'olá' });
  });

  it('valida metadados de imagem: https, mime permitido e fileId', async () => {
    const validos = { fileId: 'file-1', url: 'https://cdn.v0x.lol/file-1.png', mimeType: 'image/png' };

    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { avatar: { ...validos, url: 'http://cdn.v0x.lol/file-1.png' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { avatar: { ...validos, mimeType: 'application/php' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { avatar: { ...validos, fileId: '' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      profileService.updateProfile('uid-1', 'e@x.com', { avatar: 'https://cdn.v0x.lol/x.png' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    userService.upsertProfile.mockResolvedValue({ profile: PROFILE, created: false, replacedImages: {} });
    await profileService.updateProfile('uid-1', 'e@x.com', { avatar: validos });
    expect(userService.upsertProfile).toHaveBeenCalledWith('uid-1', 'e@x.com', { avatar: validos });
  });

  it('devolve o perfil atualizado e limpa imagens substituídas no V0X', async () => {
    userService.upsertProfile.mockResolvedValue({
      profile: PROFILE,
      created: false,
      replacedImages: { avatar: { fileId: 'avatar-antigo' }, banner: { fileId: 'banner-antigo' } },
    });
    v0xService.deleteFile.mockResolvedValue(undefined);

    const result = await profileService.updateProfile('uid-1', 'e@x.com', { displayName: 'Vasil 2' });

    expect(result).toBe(PROFILE);
    expect(v0xService.deleteFile).toHaveBeenCalledTimes(2);
    expect(v0xService.deleteFile).toHaveBeenCalledWith('avatar-antigo');
    expect(v0xService.deleteFile).toHaveBeenCalledWith('banner-antigo');
  });

  it('tolera falha na exclusão da imagem antiga (best-effort, §16)', async () => {
    userService.upsertProfile.mockResolvedValue({
      profile: PROFILE,
      created: false,
      replacedImages: { avatar: { fileId: 'avatar-antigo' } },
    });
    v0xService.deleteFile.mockRejectedValue(new Error('v0x fora do ar'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await profileService.updateProfile('uid-1', 'e@x.com', { bio: 'nova' });

    expect(result).toBe(PROFILE);
    consoleError.mockRestore();
  });
});

describe('uploadProfileImage', () => {
  it('rejeita slot inválido', async () => {
    await expect(
      profileService.uploadProfileImage('uid-1', 'favicon', { buffer: PNG_BYTES, originalname: 'a.png' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejeita arquivo ausente ou vazio', async () => {
    await expect(profileService.uploadProfileImage('uid-1', 'avatar', undefined)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      profileService.uploadProfileImage('uid-1', 'avatar', { buffer: Buffer.alloc(0), originalname: 'a.png' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejeita arquivo maior que o limite do slot (413)', async () => {
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1);

    await expect(
      profileService.uploadProfileImage('uid-1', 'avatar', { buffer: grande, originalname: 'grande.png' }),
    ).rejects.toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(v0xService.uploadFile).not.toHaveBeenCalled();
  });

  it('rejeita conteúdo que não é imagem pelos magic bytes (415)', async () => {
    const malicioso = Buffer.from('<?php echo "nao sou imagem"; ?>');

    await expect(
      profileService.uploadProfileImage('uid-1', 'avatar', {
        buffer: malicioso,
        originalname: 'shell.php.png',
        mimetype: 'image/png',
      }),
    ).rejects.toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(v0xService.uploadFile).not.toHaveBeenCalled();
  });

  it('retorna 502 UPLOAD_FAILED quando o V0X falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    v0xService.uploadFile.mockRejectedValue(new Error('v0x fora do ar'));

    await expect(
      profileService.uploadProfileImage('uid-1', 'avatar', { buffer: PNG_BYTES, originalname: 'avatar.png' }),
    ).rejects.toMatchObject({ statusCode: 502, code: 'UPLOAD_FAILED' });
    expect(userService.setImage).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('faz upload ao V0X com o mime detectado e persiste metadados no Mongo', async () => {
    v0xService.uploadFile.mockResolvedValue({
      fileId: 'avatar-novo',
      url: 'https://cdn.v0x.lol/avatar-novo.png',
      mimeType: 'image/png',
    });
    userService.setImage.mockResolvedValue({ profile: PROFILE, previous: { fileId: 'avatar-antigo' } });
    v0xService.deleteFile.mockResolvedValue(undefined);

    const result = await profileService.uploadProfileImage('uid-1', 'avatar', {
      buffer: PNG_BYTES,
      originalname: 'avatar.png',
      mimetype: 'image/png',
    });

    expect(result).toBe(PROFILE);
    expect(v0xService.uploadFile).toHaveBeenCalledWith(PNG_BYTES, 'avatar.png', 'image/png');
    expect(userService.setImage).toHaveBeenCalledWith('uid-1', 'avatar', {
      fileId: 'avatar-novo',
      url: 'https://cdn.v0x.lol/avatar-novo.png',
      mimeType: 'image/png',
    });
    expect(v0xService.deleteFile).toHaveBeenCalledWith('avatar-antigo');
  });

  it('retorna 404 PROFILE_NOT_FOUND quando o perfil ainda não existe', async () => {
    v0xService.uploadFile.mockResolvedValue({ fileId: 'x', url: 'https://cdn.v0x.lol/x.png', mimeType: 'image/png' });
    userService.setImage.mockResolvedValue(null);

    await expect(
      profileService.uploadProfileImage('uid-1', 'banner', { buffer: PNG_BYTES, originalname: 'banner.png' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  });

  it('tolera falha ao excluir a imagem anterior (§16)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    v0xService.uploadFile.mockResolvedValue({
      fileId: 'avatar-novo',
      url: 'https://cdn.v0x.lol/avatar-novo.png',
      mimeType: 'image/png',
    });
    userService.setImage.mockResolvedValue({ profile: PROFILE, previous: { fileId: 'avatar-antigo' } });
    v0xService.deleteFile.mockRejectedValue(new Error('falha ao excluir'));

    const result = await profileService.uploadProfileImage('uid-1', 'avatar', {
      buffer: PNG_BYTES,
      originalname: 'avatar.png',
    });

    expect(result).toBe(PROFILE);
    consoleError.mockRestore();
  });

  it('não tenta excluir quando não havia imagem anterior', async () => {
    v0xService.uploadFile.mockResolvedValue({
      fileId: 'avatar-novo',
      url: 'https://cdn.v0x.lol/avatar-novo.png',
      mimeType: 'image/png',
    });
    userService.setImage.mockResolvedValue({ profile: PROFILE, previous: null });

    await profileService.uploadProfileImage('uid-1', 'avatar', {
      buffer: PNG_BYTES,
      originalname: 'avatar.png',
    });

    expect(v0xService.deleteFile).not.toHaveBeenCalled();
  });
});
