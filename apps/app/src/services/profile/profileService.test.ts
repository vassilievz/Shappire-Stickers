import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveProfile, type ProfileDraft } from './profileService';
import { AppError } from '@/shared/errors';
import type { UserProfile } from '@/services/firebase/types';
import type { ProfileImage } from '@/domain/profile';
import { updateProfile, uploadProfileImage } from '@/services/api/profileApi';

vi.mock('@/services/api/profileApi', () => ({
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

const updateProfileMock = vi.mocked(updateProfile);
const uploadProfileImageMock = vi.mocked(uploadProfileImage);

const avatarMeta: ProfileImage = {
  fileId: 'file-avatar-1',
  url: 'https://cdn.example/avatar.webp',
  mimeType: 'image/webp',
};

const currentProfile: UserProfile = {
  uid: 'user-1',
  displayName: 'Gabriel',
  email: 'gabriel@example.com',
  photoURL: null,
  username: 'gabriel',
  bio: '',
  avatar: null,
  banner: null,
};

function baseDraft(): ProfileDraft {
  return {
    displayName: 'Gabriel',
    username: 'gabriel',
    bio: '',
    avatar: { kind: 'keep' },
    banner: { kind: 'keep' },
  };
}

beforeEach(() => {
  updateProfileMock.mockReset().mockImplementation(async (patch) => ({
    ...currentProfile,
    displayName: patch.displayName,
    username: patch.username,
    bio: patch.bio,
    avatar: patch.avatar,
    banner: patch.banner,
  }));
  uploadProfileImageMock.mockReset();
});

describe('saveProfile — validação local', () => {
  it('rejeita nome de exibição vazio', async () => {
    await expect(saveProfile(currentProfile, { ...baseDraft(), displayName: '   ' }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT', details: { field: 'displayName' } });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('rejeita bio acima do limite', async () => {
    await expect(saveProfile(currentProfile, { ...baseDraft(), bio: 'a'.repeat(161) }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT', details: { field: 'bio' } });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('rejeita username com caracteres inválidos', async () => {
    await expect(saveProfile(currentProfile, { ...baseDraft(), username: 'user name' }))
      .rejects.toMatchObject({
        code: 'INVALID_INPUT',
        details: { field: 'username', reason: 'chars' },
      });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('rejeita username curto demais', async () => {
    await expect(saveProfile(currentProfile, { ...baseDraft(), username: 'ab' }))
      .rejects.toMatchObject({
        code: 'INVALID_INPUT',
        details: { field: 'username', reason: 'length' },
      });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});

describe('saveProfile — PATCH consolidado', () => {
  it('grava um único PATCH com campos aparados e username normalizado', async () => {
    const draft: ProfileDraft = {
      displayName: '  Gabriel Souza  ',
      username: ' Vassilievz ',
      bio: '  Criador de figurinhas  ',
      avatar: { kind: 'keep' },
      banner: { kind: 'keep' },
    };

    const profile = await saveProfile(currentProfile, draft);

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock).toHaveBeenCalledWith({
      displayName: 'Gabriel Souza',
      username: 'vassilievz',
      bio: 'Criador de figurinhas',
      avatar: currentProfile.avatar,
      banner: currentProfile.banner,
    });
    expect(profile.username).toBe('vassilievz');
  });

  it('limpa o username quando o campo fica vazio', async () => {
    await saveProfile(currentProfile, { ...baseDraft(), username: '   ' });

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ username: null }),
    );
  });

  it('mantém as imagens atuais quando as ações são keep', async () => {
    const withAvatar: UserProfile = { ...currentProfile, avatar: avatarMeta };

    await saveProfile(withAvatar, baseDraft());

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: avatarMeta }),
    );
    expect(uploadProfileImageMock).not.toHaveBeenCalled();
  });

  it('remove a imagem quando a ação é remove', async () => {
    const withAvatar: UserProfile = { ...currentProfile, avatar: avatarMeta };

    await saveProfile(withAvatar, { ...baseDraft(), avatar: { kind: 'remove' } });

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: null }),
    );
    expect(uploadProfileImageMock).not.toHaveBeenCalled();
  });
});

describe('saveProfile — upload de imagem do aparelho', () => {
  function stubDataUrlFetch(sizeBytes: number, type = 'image/png') {
    const blob = new Blob(['x'.repeat(sizeBytes)], { type });
    const fetchMock = vi.fn(async () => ({ blob: async () => blob }));
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, blob };
  }

  it('garante o perfil no MongoDB via PATCH e depois sobe a imagem do aparelho', async () => {
    const { fetchMock, blob } = stubDataUrlFetch(1024);
    try {
      uploadProfileImageMock.mockResolvedValue({ ...currentProfile, avatar: avatarMeta });

      const draft: ProfileDraft = {
        ...baseDraft(),
        avatar: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      const profile = await saveProfile(currentProfile, draft);

      expect(fetchMock).toHaveBeenCalledWith('data:image/png;base64,AAAA');
      expect(updateProfileMock).toHaveBeenCalledTimes(1);
      expect(updateProfileMock).toHaveBeenCalledWith({
        displayName: 'Gabriel',
        username: 'gabriel',
        bio: '',
        avatar: null,
        banner: null,
      });
      expect(uploadProfileImageMock).toHaveBeenCalledWith('avatar', blob);
      expect(profile.avatar).toEqual(avatarMeta);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pré-checa o limite de tamanho sem gastar rede (§15)', async () => {
    const { fetchMock } = stubDataUrlFetch(5 * 1024 * 1024 + 1);
    try {
      const draft: ProfileDraft = {
        ...baseDraft(),
        avatar: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      await expect(saveProfile(currentProfile, draft)).rejects.toMatchObject({
        code: 'IMAGE_TOO_LARGE',
        details: { field: 'avatar' },
      });
      expect(fetchMock).toHaveBeenCalled();
      expect(uploadProfileImageMock).not.toHaveBeenCalled();
      expect(updateProfileMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('aplica o limite maior para capa (10 MB)', async () => {
    stubDataUrlFetch(10 * 1024 * 1024 + 1);
    try {
      const draft: ProfileDraft = {
        ...baseDraft(),
        banner: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      await expect(saveProfile(currentProfile, draft)).rejects.toMatchObject({
        code: 'IMAGE_TOO_LARGE',
        details: { field: 'banner' },
      });
      expect(uploadProfileImageMock).not.toHaveBeenCalled();
      expect(updateProfileMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falha com UPLOAD_FAILED quando a resposta do upload não traz metadados', async () => {
    stubDataUrlFetch(512);
    try {
      uploadProfileImageMock.mockResolvedValue({ ...currentProfile, avatar: null });

      const draft: ProfileDraft = {
        ...baseDraft(),
        avatar: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      await expect(saveProfile(currentProfile, draft)).rejects.toMatchObject({
        code: 'UPLOAD_FAILED',
      });
      expect(updateProfileMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('propaga o erro do upload quando o envio da imagem falha', async () => {
    stubDataUrlFetch(512);
    try {
      uploadProfileImageMock.mockRejectedValue(new AppError('OFFLINE', 'sem rede'));

      const draft: ProfileDraft = {
        ...baseDraft(),
        avatar: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      await expect(saveProfile(currentProfile, draft)).rejects.toMatchObject({
        code: 'OFFLINE',
      });
      expect(updateProfileMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('não envia o upload da imagem se o PATCH falhar (ex: USERNAME_TAKEN)', async () => {
    stubDataUrlFetch(512);
    try {
      updateProfileMock.mockRejectedValueOnce(
        new AppError('USERNAME_TAKEN', 'Usuário já em uso.', {
          details: { field: 'username', reason: 'USERNAME_TAKEN' },
        }),
      );

      const draft: ProfileDraft = {
        ...baseDraft(),
        avatar: { kind: 'device', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
      };

      await expect(saveProfile(currentProfile, draft)).rejects.toMatchObject({
        code: 'USERNAME_TAKEN',
      });
      expect(uploadProfileImageMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveProfile — erros da API', () => {
  it('propaga AppError intacto quando o PATCH falha', async () => {
    updateProfileMock.mockRejectedValueOnce(
      new AppError('USERNAME_TAKEN', 'Usuário já em uso.', {
        details: { field: 'username', reason: 'USERNAME_TAKEN' },
      }),
    );

    await expect(saveProfile(currentProfile, baseDraft())).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
});
