import { describe, it, expect } from 'vitest';
import { uploadProfilePicture } from './storage';

describe('Firebase Storage Validation', () => {
  it('rejeita upload sem UID', async () => {
    const blob = new Blob(['teste'], { type: 'image/png' });
    await expect(uploadProfilePicture('', blob)).rejects.toThrow('UID do usuário obrigatório');
  });

  it('rejeita arquivo maior que 5 MB', async () => {
    // Cria um blob simulado de 6 MB
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' });
    await expect(uploadProfilePicture('user-123', largeBlob)).rejects.toThrow('excede o tamanho máximo');
  });

  it('rejeita formatos de arquivo não suportados (ex: txt, pdf, svg)', async () => {
    const txtBlob = new Blob(['conteudo'], { type: 'text/plain' });
    await expect(uploadProfilePicture('user-123', txtBlob)).rejects.toThrow('Formato de imagem não suportado');
  });
});
