import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileSystemGateway } from './memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from './gateway';
import { loadCachedProfile, saveCachedProfile } from './profileRepository';
import { profileCachePath } from './paths';
import { SCHEMA_VERSION } from '@/config/storage';
import type { UserProfile } from '@/services/firebase/types';

const profile: UserProfile = {
  uid: 'user-1',
  displayName: 'Gabriel',
  email: 'gabriel@example.com',
  photoURL: null,
  username: 'gabriel',
  bio: 'Criador de figurinhas',
  avatar: { fileId: 'file-avatar-1', url: 'https://cdn.example.com/me.png', mimeType: 'image/png' },
  banner: null,
  badges: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('profileRepository — cache offline-first', () => {
  it('retorna null quando não há cache (primeira execução)', async () => {
    expect(await loadCachedProfile('user-1')).toBeNull();
  });

  it('grava e recarrega o último estado conhecido por uid', async () => {
    await saveCachedProfile(profile);

    const loaded = await loadCachedProfile('user-1');
    expect(loaded).toEqual(profile);
  });

  it('isola o cache por uid', async () => {
    await saveCachedProfile(profile);

    expect(await loadCachedProfile('outro-uid')).toBeNull();
  });

  it('grava o documento com a versão de schema atual', async () => {
    await saveCachedProfile(profile);

    const data = await getFileSystemGateway().readTextFile(profileCachePath('user-1'));
    expect(JSON.parse(data)).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      profile: { uid: 'user-1', username: 'gabriel' },
    });
  });

  it('descarta cache corrompido sem lançar (nunca vira estado inválido)', async () => {
    await getFileSystemGateway().writeTextFile(profileCachePath('user-1'), '{ não é json');

    expect(await loadCachedProfile('user-1')).toBeNull();
  });

  it('retorna null quando o campo profile não é um objeto', async () => {
    await getFileSystemGateway().writeTextFile(
      profileCachePath('user-1'),
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, profile: 'lixo' }),
    );

    expect(await loadCachedProfile('user-1')).toBeNull();
  });

  it('sanitiza campos inválidos preservando o restante do perfil', async () => {
    await getFileSystemGateway().writeTextFile(
      profileCachePath('user-1'),
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        profile: {
          ...profile,
          avatar: { fileId: 'file-avatar-1', url: 'javascript:alert(1)', mimeType: 'image/png' },
          username: 'Usuário Inválido!',
        },
      }),
    );

    const loaded = await loadCachedProfile('user-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.displayName).toBe('Gabriel');
    expect(loaded?.avatar).toBeNull();
    expect(loaded?.username).toBe('Usuário Inválido!');
  });
});
