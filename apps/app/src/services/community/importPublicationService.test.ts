import { describe, expect, it } from 'vitest';
import type { PublicationDetail } from '@shappire/contracts';
import { importPublicationToLibrary } from './importPublicationService';

describe('importPublicationToLibrary', () => {
  it('rejeita publicação sem stickers reais', async () => {
    const detail = { stickers: [] } as unknown as PublicationDetail;
    await expect(importPublicationToLibrary(detail)).rejects.toThrow('IMPORT_NO_STICKERS');
  });
});
