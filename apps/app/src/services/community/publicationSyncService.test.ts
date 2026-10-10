import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/packs/packService', () => ({
  readStickerDataUrl: vi.fn(async () => 'data:image/png;base64,AA=='),
}));

vi.mock('@/services/api/socialApi', () => ({
  upsertPublicationDraft: vi.fn(async () => ({ id: 'pub-1' })),
  uploadPublicationSticker: vi.fn(async () => ({})),
  publishPublication: vi.fn(async () => ({ id: 'pub-1' })),
  unpublishPublication: vi.fn(),
}));

import { uploadPublicationSticker } from '@/services/api/socialApi';
import { syncPackToPublication } from './publicationSyncService';

describe('syncPackToPublication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads stickers with bounded concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(uploadPublicationSticker).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { id: 'pub-1' } as never;
    });

    const pack = {
      id: 'pack-1',
      name: 'Test',
      stickers: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        fileName: `s${i}.png`,
        emojis: [],
        accessibilityText: '',
        width: 512,
        height: 512,
        isAnimated: false,
      })),
    } as unknown as import('@/domain/stickerPack').StickerPack;

    await syncPackToPublication({
      pack,
      description: '',
      isAdultContent: false,
      makePublic: false,
    });

    expect(uploadPublicationSticker).toHaveBeenCalledTimes(6);
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
