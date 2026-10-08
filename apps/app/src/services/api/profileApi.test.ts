import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ROUTES } from '@shappire/contracts';
import { fetchProfile, updateProfile, uploadProfileImage } from './profileApi';
import { AppError } from '@/shared/errors';

const mocks = vi.hoisted(() => ({
  currentUser: null as { uid: string; photoURL: string | null } | null,
  apiRequest: vi.fn(),
}));

vi.mock('@/services/firebase/config', () => ({
  getFirebaseAuth: () => ({ currentUser: mocks.currentUser }),
}));

vi.mock('@/services/api/client', () => ({
  apiRequest: mocks.apiRequest,
  UPLOAD_TIMEOUT_MS: 60_000,
  DEFAULT_TIMEOUT_MS: 15_000,
}));

const apiProfileBody = {
  uid: 'user-1',
  email: 'gabriel@example.com',
  displayName: 'Gabriel',
  username: 'gabriel',
  bio: 'Criador de figurinhas',
  avatar: { fileId: 'file-1', url: 'https://cdn.example.com/avatar.webp', mimeType: 'image/webp' },
  banner: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

beforeEach(() => {
  mocks.currentUser = { uid: 'user-1', photoURL: 'https://lh3.googleusercontent.com/g.png' };
  mocks.apiRequest.mockReset().mockResolvedValue({ status: 200, body: apiProfileBody });
});

describe('fetchProfile', () => {
  it('converte a resposta em UserProfile completando photoURL do Firebase Auth', async () => {
    const profile = await fetchProfile();

    expect(profile).toEqual({
      uid: 'user-1',
      email: 'gabriel@example.com',
      displayName: 'Gabriel',
      photoURL: 'https://lh3.googleusercontent.com/g.png',
      username: 'gabriel',
      bio: 'Criador de figurinhas',
      avatar: apiProfileBody.avatar,
      banner: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith(API_ROUTES.profile);
  });

  it('devolve null quando o perfil ainda não existe (PROFILE_NOT_FOUND)', async () => {
    mocks.apiRequest.mockRejectedValueOnce(
      new AppError('NOT_FOUND', 'Perfil não encontrado.', { details: { reason: 'PROFILE_NOT_FOUND' } }),
    );

    expect(await fetchProfile()).toBeNull();
  });

  it('propaga outros erros intactos', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new AppError('OFFLINE', 'sem rede'));

    await expect(fetchProfile()).rejects.toMatchObject({ code: 'OFFLINE' });
  });

  it('resposta não-objeto vira null (nunca quebra a UI)', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ status: 200, body: 'lixo' });

    expect(await fetchProfile()).toBeNull();
  });

  it('sem usuário logado lança UNAUTHORIZED sem chamar a API', async () => {
    mocks.currentUser = null;

    await expect(fetchProfile()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });
});

describe('updateProfile', () => {
  it('envia PATCH com o patch serializado em JSON', async () => {
    const patch = {
      displayName: 'Gabriel Souza',
      username: 'gabriel',
      bio: 'bio nova',
      avatar: apiProfileBody.avatar,
      banner: null,
    };

    const profile = await updateProfile(patch);

    expect(mocks.apiRequest).toHaveBeenCalledWith(API_ROUTES.profile, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    expect(profile.username).toBe('gabriel');
  });

  it('corpo de resposta inválido vira DATA_CORRUPTED', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ status: 200, body: null });

    await expect(
      updateProfile({ displayName: 'G', username: null, bio: '', avatar: null, banner: null }),
    ).rejects.toMatchObject({ code: 'DATA_CORRUPTED' });
  });
});

describe('uploadProfileImage', () => {
  it('envia multipart no campo file com rota e nome do slot (§14)', async () => {
    const profile = await uploadProfileImage('avatar', new Blob(['dados'], { type: 'image/png' }));

    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
    const [route, init] = mocks.apiRequest.mock.calls[0] ?? [];
    expect(route).toBe(API_ROUTES.avatar);
    expect(init.method).toBe('POST');
    expect(init.timeoutMs).toBe(60_000);
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const file = form.get('file') as File;
    expect(file.name).toBe('avatar.png');
    expect(file.type).toBe('image/png');
    expect(profile.avatar).toEqual(apiProfileBody.avatar);
  });

  it('usa a extensão correspondente ao MIME (gif → banner.gif)', async () => {
    await uploadProfileImage('banner', new Blob(['dados'], { type: 'image/gif' }));

    const [route, init] = mocks.apiRequest.mock.calls[0] ?? [];
    expect(route).toBe(API_ROUTES.banner);
    expect((init.body as FormData).get('file')).toMatchObject({ name: 'banner.gif' });
  });

  it('corpo de resposta inválido vira DATA_CORRUPTED', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ status: 200, body: 42 });

    await expect(
      uploadProfileImage('avatar', new Blob(['x'], { type: 'image/png' })),
    ).rejects.toMatchObject({ code: 'DATA_CORRUPTED' });
  });
});
