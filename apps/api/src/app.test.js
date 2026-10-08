import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

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

vi.mock('./services/profileService.js', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

import admin from 'firebase-admin';
import { createApp } from './server.js';
import { ApiError } from './utils/apiError.js';
import * as profileService from './services/profileService.js';

const { verifyIdToken } = admin.auth();

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const PROFILE = {
  uid: 'route-user',
  email: 'user@example.com',
  displayName: 'Vasil',
  username: 'vasil',
  bio: '',
  avatar: null,
  banner: null,
  createdAt: null,
  updatedAt: null,
};

let server;
let baseUrl;

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Um uid novo por teste: os rate limiters (§26) têm chave por uid.
let sequencia = 0;
function autenticar() {
  sequencia += 1;
  verifyIdToken.mockReset();
  verifyIdToken.mockResolvedValue({
    uid: `route-user-${sequencia}`,
    email: `user${sequencia}@example.com`,
  });
  return {
    token: `token-${sequencia}`,
    uid: `route-user-${sequencia}`,
    email: `user${sequencia}@example.com`,
  };
}

beforeEach(() => {
  profileService.getProfile.mockReset();
  profileService.updateProfile.mockReset();
  profileService.uploadProfileImage.mockReset();
});

describe('GET /health', () => {
  it('responde o estado do serviço sem expor credenciais', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
      service: 'shappire-api',
      mongodb: 'disconnected',
      v0x: 'configured',
    });
    expect(Object.keys(body).sort()).toEqual(['mongodb', 'service', 'status', 'v0x']);
  });
});

describe('rota desconhecida', () => {
  it('responde 404 no formato de erro padrão', async () => {
    const res = await fetch(`${baseUrl}/rota-inexistente`);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
    expect(typeof body.message).toBe('string');
  });
});

describe('CORS', () => {
  it('permite a origem do WebView do Capacitor Android (https://localhost)', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'PATCH' },
    });

    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://localhost');
  });

  it('não reflete origem não autorizada', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PATCH' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('GET /api/profile', () => {
  it('exige token Firebase (401 sem Authorization)', async () => {
    const res = await fetch(`${baseUrl}/api/profile`);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
    expect(typeof body.message).toBe('string');
  });

  it('rejeita token inválido ou expirado (401)', async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValue(new Error('token expirado'));

    const res = await fetch(`${baseUrl}/api/profile`, { headers: { Authorization: 'Bearer token-ruim' } });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('retorna o perfil do usuário autenticado', async () => {
    const { token, uid } = autenticar();
    profileService.getProfile.mockResolvedValue({ ...PROFILE, uid });

    const res = await fetch(`${baseUrl}/api/profile`, { headers: { Authorization: `Bearer ${token}` } });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ uid });
    expect(profileService.getProfile).toHaveBeenCalledWith(uid);
  });

  it('propaga PROFILE_NOT_FOUND (404) no formato de erro padrão', async () => {
    const { token } = autenticar();
    profileService.getProfile.mockRejectedValue(new ApiError(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.'));

    const res = await fetch(`${baseUrl}/api/profile`, { headers: { Authorization: `Bearer ${token}` } });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado.' });
  });
});

describe('PATCH /api/profile', () => {
  it('atualiza o perfil do usuário do token com o corpo enviado', async () => {
    const { token, uid, email } = autenticar();
    const atualizado = { ...PROFILE, uid, displayName: 'Vasil 2' };
    profileService.updateProfile.mockResolvedValue(atualizado);

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Vasil 2' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(atualizado);
    expect(profileService.updateProfile).toHaveBeenCalledWith(uid, email, { displayName: 'Vasil 2' });
  });

  it('propaga USERNAME_TAKEN (409)', async () => {
    const { token } = autenticar();
    profileService.updateProfile.mockRejectedValue(
      new ApiError(409, 'USERNAME_TAKEN', 'Este username já está em uso.'),
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'vasil' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('USERNAME_TAKEN');
    expect(typeof body.message).toBe('string');
  });

  it('exige autenticação', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bio: 'x' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/profile/avatar', () => {
  it('aceita multipart e repassa o arquivo ao service', async () => {
    const { token, uid } = autenticar();
    profileService.uploadProfileImage.mockResolvedValue({ ...PROFILE, uid });

    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'avatar.png');

    const res = await fetch(`${baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ uid });

    const [uidChamado, slot, arquivo] = profileService.uploadProfileImage.mock.calls[0];
    expect(uidChamado).toBe(uid);
    expect(slot).toBe('avatar');
    expect(arquivo.originalname).toBe('avatar.png');
    expect(arquivo.mimetype).toBe('image/png');
    expect(arquivo.buffer).toBeInstanceOf(Buffer);
    expect(arquivo.buffer.length).toBe(PNG_BYTES.length);
  });

  it('rejeita requisição sem o campo "file" (400)', async () => {
    const { token } = autenticar();
    const form = new FormData();
    form.append('outro', 'valor');

    const res = await fetch(`${baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(profileService.uploadProfileImage).not.toHaveBeenCalled();
  });

  it('rejeita mime não permitido já no multer (415)', async () => {
    const { token } = autenticar();
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('qualquer coisa')], { type: 'application/pdf' }), 'doc.pdf');

    const res = await fetch(`${baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('propaga falha de upload do V0X como 502', async () => {
    const { token } = autenticar();
    profileService.uploadProfileImage.mockRejectedValue(
      new ApiError(502, 'UPLOAD_FAILED', 'Falha ao enviar a imagem. Tente novamente.'),
    );

    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'avatar.png');

    const res = await fetch(`${baseUrl}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('UPLOAD_FAILED');
  });
});

describe('POST /api/profile/banner', () => {
  it('aceita multipart para o slot banner', async () => {
    const { token, uid } = autenticar();
    profileService.uploadProfileImage.mockResolvedValue({ ...PROFILE, uid });

    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'banner.png');

    const res = await fetch(`${baseUrl}/api/profile/banner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(200);
    expect(profileService.uploadProfileImage.mock.calls[0][1]).toBe('banner');
  });
});
